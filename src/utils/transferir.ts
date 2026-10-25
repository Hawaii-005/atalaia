import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { urlGcode } from './miniatura';

/**
 * Descarrega um .gcode da impressora para a memória temporária da app.
 *
 * O ficheiro é pedido por HTTP à placa (`/local/<nome>`), que é o mesmo caminho
 * que a SPA usa. Fica em `cacheDirectory` porque a app não pode escrever na
 * pasta pública do Android sem permissões; quem guarda é o utilizador, através
 * do menu de partilha do sistema ("Guardar em Ficheiros" → Downloads).
 *
 * Devolve o caminho local e o tamanho em bytes.
 */
export const descarregarGcode = async (
  ip: string,
  nome: string,
  aoProgresso?: (fracao: number) => void
): Promise<{ uri: string; bytes: number }> => {
  const limpo = nome.split('/').pop() ?? nome;
  // Pasta própria para o nome que o menu de partilha mostra ser só o do ficheiro.
  const pasta = `${FileSystem.cacheDirectory}gcode/`;
  const infoPasta = await FileSystem.getInfoAsync(pasta);
  if (!infoPasta.exists) await FileSystem.makeDirectoryAsync(pasta, { intermediates: true });
  const destino = `${pasta}${limpo}`;

  const tarefa = FileSystem.createDownloadResumable(
    urlGcode(ip, limpo),
    destino,
    {},
    (progresso) => {
      const total = progresso.totalBytesExpectedToWrite;
      if (total > 0) aoProgresso?.(progresso.totalBytesWritten / total);
    }
  );

  const resultado = await tarefa.downloadAsync();
  if (!resultado || resultado.status !== 200) {
    await FileSystem.deleteAsync(destino, { idempotent: true });
    throw new Error(`HTTP ${resultado?.status ?? '?'}`);
  }

  const info = await FileSystem.getInfoAsync(destino);
  return {
    uri: destino,
    bytes: info.exists && 'size' in info ? Number(info.size ?? 0) : 0,
  };
};

/** Abre o menu do sistema para o utilizador guardar/enviar o ficheiro. */
export const partilharFicheiro = async (uri: string, titulo: string) => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('sem-partilha');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: titulo,
    UTI: 'public.data',
  });
};
