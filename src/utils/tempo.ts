/**
 * Tempo legível, sem i18n e sem React Native.
 *
 * Vive separado do `FormatUtils` porque esse ficheiro importa o dicionário
 * (e o dicionário importa `expo-localization`): os testes puros não conseguem
 * carregá-lo. Aqui é só aritmética.
 */

/** Segundos → «2h30m», «45m», «0m». */
export const formatTicksToReadableTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) {
    return '0m';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};
