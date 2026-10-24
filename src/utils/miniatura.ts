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

const lerPrimeirosBytes = async (url: string, comRange: boolean) => {
  const resposta = await fetch(url, {
    headers: comRange ? { Range: 'bytes=0-262143' } : undefined,
  });
  if (!resposta.ok) return '';
  return resposta.text();
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
    let texto = await lerPrimeirosBytes(url, true);
    if (!texto) texto = await lerPrimeirosBytes(url, false);
    if (!texto) {
      cacheEmbutidas.set(chave, null);
      return null;
    }
    const bloco = texto.match(/thumbnail begin \d+x\d+ \d+([\s\S]*?)thumbnail end/);
    if (!bloco) {
      cacheEmbutidas.set(chave, null);
      return null;
    }
    const base64 = bloco[1]
      .split('\n')
      .map(linha => linha.replace(/^;\s?/, '').trim())
      .filter(linha => linha && /^[A-Za-z0-9+/=]+$/.test(linha))
      .join('');
    if (!base64) {
      cacheEmbutidas.set(chave, null);
      return null;
    }
    const uri = `data:image/png;base64,${base64}`;
    cacheEmbutidas.set(chave, uri);
    return uri;
  } catch (erro) {
    log('miniatura embutida falhou', erro instanceof Error ? erro.stack : String(erro));
    cacheEmbutidas.set(chave, null);
    return null;
  }
};
