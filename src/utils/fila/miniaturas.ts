/**
 * Miniaturas dos itens da fila.
 *
 * O G-code traz a imagem embutida (bloco `thumbnail begin`); extrai-se uma vez,
 * guarda-se em ficheiro na cache e o item guarda só o nome do ficheiro — nunca
 * base64 no AsyncStorage nem na cópia de segurança.
 */
import * as FileSystem from 'expo-file-system';
import { log } from '../log';
import { extrairMiniaturaEmbutidaFila } from '../miniatura';

const PASTA = `${FileSystem.cacheDirectory}atalaia/miniaturas/`;

/** Hash estável (djb2) para o nome do ficheiro. */
export const chaveDaMiniatura = (printerId: string, nome: string): string => {
  let hash = 5381;
  const texto = `${printerId}|${nome}`;
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) + hash + texto.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

export const caminhoDaMiniatura = (ficheiro: string): string =>
  `${PASTA}${ficheiro}`;

/**
 * Extrai e guarda a miniatura. Devolve o nome do ficheiro, ou `undefined` se o
 * G-code não tiver imagem — não é um erro, é uma ausência.
 */
export const guardarMiniaturaDoItem = async (
  ip: string,
  nome: string,
  printerId: string
): Promise<string | undefined> => {
  try {
    const uri = await extrairMiniaturaEmbutidaFila(ip, nome);
    if (!uri) return undefined;
    const base64 = uri.split(',')[1];
    if (!base64) return undefined;
    await FileSystem.makeDirectoryAsync(PASTA, { intermediates: true }).catch(
      () => undefined
    );
    const ficheiro = `${chaveDaMiniatura(printerId, nome)}.png`;
    await FileSystem.writeAsStringAsync(caminhoDaMiniatura(ficheiro), base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return ficheiro;
  } catch (erro) {
    log('fila: miniatura falhou', erro);
    return undefined;
  }
};
