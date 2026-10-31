import AsyncStorage from '@react-native-async-storage/async-storage';

const chavePrinter = (printerId: string) => `atalaia.timelapse.${printerId}`;
const CHAVE_EXPERIMENTAL = 'atalaia.timelapse.experimental';

export const lerTimelapseExperimental = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(CHAVE_EXPERIMENTAL)) === '1';
  } catch {
    return false;
  }
};

export const guardarTimelapseExperimental = async (
  ligado: boolean
): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHAVE_EXPERIMENTAL, ligado ? '1' : '0');
  } catch {
    // ignorar
  }
};

export const lerTimelapse = async (printerId: string): Promise<boolean> => {
  try {
    const exp = await lerTimelapseExperimental();
    if (!exp) return false;
    return (await AsyncStorage.getItem(chavePrinter(printerId))) === '1';
  } catch {
    return false;
  }
};

export const guardarTimelapse = async (
  printerId: string,
  ligado: boolean
): Promise<void> => {
  try {
    await AsyncStorage.setItem(chavePrinter(printerId), ligado ? '1' : '0');
  } catch {
    // ignorar
  }
};
