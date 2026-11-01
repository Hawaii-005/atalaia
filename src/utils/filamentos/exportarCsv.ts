import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Spool, Garrafa } from './modelo';
import { gerarCsvInventario } from './operacoes';

export const partilharInventarioCsv = async (
  bobinas: Spool[],
  garrafas: Garrafa[] = []
): Promise<void> => {
  const conteudo = gerarCsvInventario(bobinas, garrafas);
  const caminho = `${FileSystem.cacheDirectory}inventario_atalaia_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(caminho, conteudo, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(caminho, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar Inventário (CSV)',
      UTI: 'public.comma-separated-values-text',
    });
  }
};
