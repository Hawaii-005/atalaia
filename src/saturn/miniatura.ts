// Miniatura do projeto para as impressoras de resina.
//
// O SDCP não dá pré-visualização nenhuma: a Saturn só publica o nome do
// ficheiro. A única fonte honesta é o próprio ficheiro fatiado. Há dois
// formatos comuns:
//
//  - CTB v4 (Chitubox antigo): a imagem é um PNG inteiro dentro do ficheiro.
//  - CTB v5 cifrado (Elegoo Saturn/Mars 3, magic 0x12FD0107): a imagem é um
//    bloco RGB15 com RLE próprio, descrito por uma estrutura de 32 bytes.
//    Verificado contra um .ctb real da Saturn 3 Ultra: 320×500, 98 034 bytes.
//
// Extrai-se quando o utilizador escolhe o ficheiro na app e guarda-se em cache
// por nome, para que uma impressão lançada depois pela pen USB também consiga
// mostrar a miniatura do último envio com esse nome.

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIXO_CHAVE = '@atalaia/miniatura/';
const PASTA = 'miniaturas/';
const JANELA_BYTES = 256 * 1024; // cabeçalho + estrutura da pré-visualização
const MAX_IMAGEM = 4 * 1024 * 1024;

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// ---------------------------------------------------------------- base64

export const deBase64 = (texto: string): Uint8Array => {
  const limpo = texto.replace(/=+$/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const tamanho = Math.floor((limpo.length * 3) / 4);
  const saida = new Uint8Array(tamanho);
  let i = 0;
  let o = 0;
  while (i < limpo.length) {
    const a = Math.max(0, ALFABETO.indexOf(limpo[i++]));
    const b = i < limpo.length ? Math.max(0, ALFABETO.indexOf(limpo[i++])) : 0;
    const c = i < limpo.length ? Math.max(0, ALFABETO.indexOf(limpo[i++])) : 0;
    const d = i < limpo.length ? Math.max(0, ALFABETO.indexOf(limpo[i++])) : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < tamanho) saida[o++] = (n >> 16) & 0xff;
    if (o < tamanho) saida[o++] = (n >> 8) & 0xff;
    if (o < tamanho) saida[o++] = n & 0xff;
  }
  return saida;
};

export const paraBase64 = (dados: Uint8Array): string => {
  let saida = '';
  const n = dados.length;
  const resto = n % 3;
  const fim = n - resto;
  for (let i = 0; i < fim; i += 3) {
    const v = (dados[i] << 16) | (dados[i + 1] << 8) | dados[i + 2];
    saida +=
      ALFABETO[(v >> 18) & 63] +
      ALFABETO[(v >> 12) & 63] +
      ALFABETO[(v >> 6) & 63] +
      ALFABETO[v & 63];
  }
  if (resto === 1) {
    const v = dados[fim] << 16;
    saida += ALFABETO[(v >> 18) & 63] + ALFABETO[(v >> 12) & 63] + '==';
  } else if (resto === 2) {
    const v = (dados[fim] << 16) | (dados[fim + 1] << 8);
    saida +=
      ALFABETO[(v >> 18) & 63] +
      ALFABETO[(v >> 12) & 63] +
      ALFABETO[(v >> 6) & 63] +
      '=';
  }
  return saida;
};

// ---------------------------------------------------------------- PNG

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (dados: Uint8Array, inicio: number, fim: number): number => {
  let c = 0xffffffff;
  for (let i = inicio; i < fim; i++)
    c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const adler32 = (dados: Uint8Array): number => {
  let a = 1;
  let b = 0;
  for (let i = 0; i < dados.length; i++) {
    a = (a + dados[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
};

/** zlib com blocos "stored" — sem biblioteca, válido e suficiente. */
const comprimirSemPerdas = (dados: Uint8Array): Uint8Array => {
  const blocos = Math.max(1, Math.ceil(dados.length / 65535));
  const saida = new Uint8Array(2 + dados.length + blocos * 5 + 4);
  let p = 0;
  saida[p++] = 0x78;
  saida[p++] = 0x01;
  for (let b = 0; b < blocos; b++) {
    const inicio = b * 65535;
    const fim = Math.min(inicio + 65535, dados.length);
    const tamanho = fim - inicio;
    saida[p++] = b === blocos - 1 ? 1 : 0;
    saida[p++] = tamanho & 0xff;
    saida[p++] = (tamanho >> 8) & 0xff;
    saida[p++] = ~tamanho & 0xff;
    saida[p++] = (~tamanho >> 8) & 0xff;
    saida.set(dados.subarray(inicio, fim), p);
    p += tamanho;
  }
  const adler = adler32(dados);
  saida[p++] = (adler >>> 24) & 0xff;
  saida[p++] = (adler >>> 16) & 0xff;
  saida[p++] = (adler >>> 8) & 0xff;
  saida[p++] = adler & 0xff;
  return saida.subarray(0, p);
};

const chunk = (tipo: string, dados: Uint8Array): Uint8Array => {
  const saida = new Uint8Array(12 + dados.length);
  const dv = new DataView(saida.buffer);
  dv.setUint32(0, dados.length);
  for (let i = 0; i < 4; i++) saida[4 + i] = tipo.charCodeAt(i);
  saida.set(dados, 8);
  dv.setUint32(8 + dados.length, crc32(saida, 4, 8 + dados.length));
  return saida;
};

/** PNG RGB de uma imagem crua (sem filtros). */
export const codificarPng = (
  rgb: Uint8Array,
  largura: number,
  altura: number
): Uint8Array => {
  const linha = largura * 3;
  const cru = new Uint8Array((linha + 1) * altura);
  for (let y = 0; y < altura; y++) {
    cru[y * (linha + 1)] = 0;
    cru.set(rgb.subarray(y * linha, (y + 1) * linha), y * (linha + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, largura);
  dv.setUint32(4, altura);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  const partes = [
    new Uint8Array(ASSINATURA_PNG),
    chunk('IHDR', ihdr),
    chunk('IDAT', comprimirSemPerdas(cru)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let p = 0;
  for (const parte of partes) {
    saida.set(parte, p);
    p += parte.length;
  }
  return saida;
};

// ---------------------------------------------------------------- CTB v4 (PNG)

const procurarPng = (dados: Uint8Array): number => {
  const n = ASSINATURA_PNG.length;
  for (let i = 0; i + n < dados.length; i++) {
    let igual = true;
    for (let j = 0; j < n; j++) {
      if (dados[i + j] !== ASSINATURA_PNG[j]) {
        igual = false;
        break;
      }
    }
    if (igual) return i;
  }
  return -1;
};

const fimDoPng = (dados: Uint8Array, inicio: number): number => {
  let p = inicio + 8;
  while (p + 8 <= dados.length) {
    const comprimento =
      (dados[p] << 24) |
      (dados[p + 1] << 16) |
      (dados[p + 2] << 8) |
      dados[p + 3];
    const tipo = String.fromCharCode(
      dados[p + 4],
      dados[p + 5],
      dados[p + 6],
      dados[p + 7]
    );
    if (comprimento < 0 || comprimento > 16 * 1024 * 1024) return -1;
    const fim = p + 8 + comprimento + 4;
    if (fim > dados.length) return -1;
    if (tipo === 'IEND') return fim;
    p = fim;
  }
  return -1;
};

// ---------------------------------------------------------------- CTB v5 (RGB15)

export type Previsao = {
  largura: number;
  altura: number;
  offset: number;
  tamanho: number;
};

const u32 = (d: Uint8Array, o: number) =>
  (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;

/**
 * Procura a estrutura da pré-visualização (32 bytes: largura, altura, offset,
 * tamanho) no início do ficheiro. Não é preciso decifrar o bloco de definições
 * do CTB v5: a estrutura e a imagem ficam fora dele.
 */
export const encontrarPrevisao = (
  cabecalho: Uint8Array,
  tamanhoFicheiro: number
): Previsao | null => {
  for (let o = 48; o + 32 <= cabecalho.length; o += 4) {
    const largura = u32(cabecalho, o);
    const altura = u32(cabecalho, o + 4);
    const offset = u32(cabecalho, o + 8);
    const tamanho = u32(cabecalho, o + 12);
    if (largura < 64 || largura > 2048 || altura < 64 || altura > 2048)
      continue;
    if (offset < 48 || tamanho < 16 || tamanho > MAX_IMAGEM) continue;
    if (offset + tamanho > tamanhoFicheiro) continue;
    return { largura, altura, offset, tamanho };
  }
  return null;
};

/**
 * Descodifica o RGB15 com RLE do Chitubox (magic 0x12FD0107). Cada pixel são
 * 2 bytes (5 bits por canal); se o bit 0x20 estiver posto, os 2 bytes seguintes
 * dizem quantas vezes o pixel se repete (12 bits).
 */
export const descodificarRgb15 = (
  dados: Uint8Array,
  largura: number,
  altura: number
): Uint8Array | null => {
  const total = largura * altura;
  const rgb = new Uint8Array(total * 3);
  let i = 0;
  let p = 0;
  while (i + 1 < dados.length && p < total * 3) {
    const ponto = dados[i] | (dados[i + 1] << 8);
    i += 2;
    const alto = ((ponto >> 11) & 0x1f) << 3;
    const medio = ((ponto >> 6) & 0x1f) << 3;
    const baixo = (ponto & 0x1f) << 3;
    let repetir = 1;
    if ((ponto & 0x20) === 0x20) {
      if (i + 1 >= dados.length) break;
      repetir += dados[i] | ((dados[i + 1] & 0x0f) << 8);
      i += 2;
    }
    for (let n = 0; n < repetir && p < total * 3; n++) {
      rgb[p++] = baixo;
      rgb[p++] = medio;
      rgb[p++] = alto;
    }
  }
  // Só aceita se preencheu a imagem toda — evita devolver lixo.
  return p === total * 3 ? rgb : null;
};

// ---------------------------------------------------------------- cache

const nomeSeguro = (nome: string) =>
  nome.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);

export const chaveMiniatura = (nome: string) => `${PREFIXO_CHAVE}${nome}`;

/** Miniatura já conhecida para este nome de ficheiro, se existir. */
export const miniaturaDe = async (nome: string): Promise<string | null> => {
  if (!nome) return null;
  const uri = await AsyncStorage.getItem(chaveMiniatura(nome));
  if (!uri) return null;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
};

const guardar = async (
  nome: string,
  png: Uint8Array
): Promise<string | null> => {
  if (!FileSystem.cacheDirectory) return null;
  const pasta = `${FileSystem.cacheDirectory}${PASTA}`;
  const destino = `${pasta}${nomeSeguro(nome)}.png`;
  await FileSystem.makeDirectoryAsync(pasta, { intermediates: true }).catch(
    () => undefined
  );
  await FileSystem.writeAsStringAsync(destino, paraBase64(png), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await AsyncStorage.setItem(chaveMiniatura(nome), destino);
  return destino;
};

/**
 * Extrai a miniatura do ficheiro fatiado e guarda-a em cache. Devolve o `uri`
 * local ou `null` (formato sem pré-visualização conhecida, ficheiro truncado,
 * leitura falhada) — nunca inventa uma imagem.
 */
export const extrairMiniatura = async (
  uri: string,
  nome: string
): Promise<string | null> => {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const tamanhoFicheiro = (info as { size?: number }).size ?? 0;
    if (!tamanhoFicheiro) return null;

    const cabecalho = deBase64(
      await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: 0,
        length: Math.min(tamanhoFicheiro, JANELA_BYTES),
      })
    );

    // CTB v4: um PNG inteiro logo a seguir ao cabeçalho.
    const inicioPng = procurarPng(cabecalho);
    if (inicioPng >= 0) {
      const fim = fimDoPng(cabecalho, inicioPng);
      if (fim > inicioPng)
        return await guardar(nome, cabecalho.slice(inicioPng, fim));
    }

    // CTB v5 cifrado: estrutura de 32 bytes + imagem RGB15 com RLE.
    const previsao = encontrarPrevisao(cabecalho, tamanhoFicheiro);
    if (!previsao) return null;
    const dados = deBase64(
      await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: previsao.offset,
        length: previsao.tamanho,
      })
    );
    const rgb = descodificarRgb15(dados, previsao.largura, previsao.altura);
    if (!rgb) return null;
    return await guardar(
      nome,
      codificarPng(rgb, previsao.largura, previsao.altura)
    );
  } catch {
    return null;
  }
};
