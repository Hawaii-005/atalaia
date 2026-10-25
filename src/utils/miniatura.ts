import { log } from './log';

/**
 * Miniaturas de um .gcode.
 *
 * A impressora serve uma PNG 144x144 em /thumbnail/<nome>.png — é a imagem
 * gerada pelo slicer, a mesma que a interface oficial mostra.
 *
 * Quando não existe (404 em ficheiros antigos), o próprio .gcode traz a
 * miniatura embutida no cabeçalho:
 *
 *   ; THUMBNAIL_BLOCK_START
 *   ; thumbnail begin 144x144 3092
 *   ; iVBORw0KGgo...
 *   ; thumbnail end
 *
 * Basta ler os primeiros 256 KiB do ficheiro. O servidor responde 416 quando
 * o intervalo pedido é maior que o ficheiro (ficheiros pequenos), por isso há
 * uma segunda tentativa sem Range.
 */

const baseDoNome = (nome: string) => nome.split('/').pop() ?? nome;

export const urlMiniatura = (ip: string, nome: string) =>
  `http://${ip}/thumbnail/${encodeURIComponent(baseDoNome(nome))}.png`;

export const urlGcode = (ip: string, nome: string) => {
  const limpo = nome.replace(/^\/?(local\/)?\/?/, '').replace(/^\//, '');
  return `http://${ip}:3030/local/${encodeURIComponent(limpo)}`;
};

const cacheEmbutidas = new Map<string, string | null>();
const MAX_CACHE = 24;

const guardarCache = (chave: string, valor: string | null) => {
  if (cacheEmbutidas.size >= MAX_CACHE) {
    const maisAntiga = cacheEmbutidas.keys().next().value;
    if (maisAntiga) cacheEmbutidas.delete(maisAntiga);
  }
  cacheEmbutidas.set(chave, valor);
};

const MAX_LEITURA = 400_000;

/**
 * Lê só o início do ficheiro. Nunca aceita uma resposta sem Range que traga o
 * G-code inteiro (o servidor da impressora responde 416 quando o intervalo é
 * maior que o ficheiro — nesse caso o chamador repete sem Range).
 */
const lerPrimeirosBytes = async (url: string, comRange: boolean) => {
  const resposta = await fetch(url, {
    headers: comRange ? { Range: 'bytes=0-262143' } : undefined,
  });
  if (resposta.status === 416) return { texto: '', estado: 416 };
  if (!resposta.ok) return { texto: '', estado: resposta.status };
  const tamanho = Number(resposta.headers.get('content-length') ?? 0);
  // Sem Range, ou com um servidor que o ignora, não vale a pena arrastar
  // dezenas de MB para a memória por causa de uma miniatura.
  if (tamanho > MAX_LEITURA && (resposta.status !== 206 || !comRange)) {
    return { texto: '', estado: resposta.status };
  }
  return { texto: await resposta.text(), estado: resposta.status };
};

/** Devolve um data URI com a PNG embutida, ou null. */
export const extrairMiniaturaEmbutida = async (
  ip: string,
  nome: string
): Promise<string | null> => {
  const chave = `${ip}|${nome}`;
  if (cacheEmbutidas.has(chave)) return cacheEmbutidas.get(chave) ?? null;
  try {
    const url = urlGcode(ip, nome);
    let leitura = await lerPrimeirosBytes(url, true);
    if (!leitura.texto && leitura.estado === 416) {
      leitura = await lerPrimeirosBytes(url, false);
    }
    if (!leitura.texto) {
      guardarCache(chave, null);
      return null;
    }
    const texto = leitura.texto;
    const inicio = texto.indexOf('thumbnail begin');
    const fim = inicio >= 0 ? texto.indexOf('thumbnail end', inicio) : -1;
    if (inicio < 0 || fim < 0) {
      guardarCache(chave, null);
      return null;
    }
    const bloco = texto.slice(texto.indexOf('\n', inicio) + 1, fim > inicio ? fim : undefined);
    // Só base64: tira os '; ' de cada linha e tudo o que não pertença ao alfabeto.
    const base64 = bloco.replace(/[^A-Za-z0-9+/=]/g, '');
    if (base64.length < 100) {
      guardarCache(chave, null);
      return null;
    }
    const uri = `data:image/png;base64,${base64}`;
    guardarCache(chave, uri);
    return uri;
  } catch (erro) {
    log('miniatura embutida falhou', erro instanceof Error ? erro.stack : String(erro));
    cacheEmbutidas.set(chave, null);
    return null;
  }
};
