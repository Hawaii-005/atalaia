import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferência de timelapse por impressora.
 *
 * O `Tlp_Switch` vai no comando de arranque (Cmd 128): se o ecrã de ficheiros
 * não o enviar, o arranque manda 0 e a máquina grava sem timelapse mesmo que
 * a opção esteja ligada nos detalhes — foi o que aconteceu com a peça a 1/22
 * camadas, com `TimeLapseStatus: 0` na impressora.
 */
const chave = (printerId: string) => `atalaia.timelapse.${printerId}`;

export const lerTimelapse = async (printerId: string): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(chave(printerId))) === '1';
  } catch {
    return false;
  }
};

export const guardarTimelapse = async (
  printerId: string,
  ligado: boolean
): Promise<void> => {
  try {
    await AsyncStorage.setItem(chave(printerId), ligado ? '1' : '0');
  } catch {
    // Sem persistência o arranque usa o valor por omissão (desligado).
  }
};
