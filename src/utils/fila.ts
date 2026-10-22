import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from './log';

/** Um trabalho à espera de vez. `name` é o nome que a impressora devolve. */
export interface ItemFila {
  id: string;
  printerId: string;
  name: string;
  label: string;
}

const CHAVE = 'filaImpressao';

export const carregarFila = async (): Promise<ItemFila[]> => {
  try {
    const cru = await AsyncStorage.getItem(CHAVE);
    if (!cru) return [];
    const lista = JSON.parse(cru);
    return Array.isArray(lista) ? (lista as ItemFila[]) : [];
  } catch (error) {
    log('fila: não consegui ler', error);
    return [];
  }
};

export const gravarFila = async (fila: ItemFila[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(fila));
  } catch (error) {
    log('fila: não consegui gravar', error);
  }
};
