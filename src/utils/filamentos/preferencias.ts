import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../log';
import { LIMITE_QUASE_NO_FIM } from './modelo';

/**
 * Preferências dos filamentos que vivem no telemóvel. Por agora só o limite do
 * aviso «quase no fim»; o valor por omissão é o do modelo (15 %).
 */

const CHAVE = 'atalaia.filamentos.limiteQuaseNoFim';

export const LIMITE_MIN = 1;
export const LIMITE_MAX = 50;

/** Aceita só inteiros entre 1 e 50; qualquer outra coisa cai no valor de hoje. */
export const normalizarLimite = (
  valor: unknown,
  actual: number = LIMITE_QUASE_NO_FIM
): number => {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
  if (typeof n !== 'number' || !Number.isFinite(n)) return actual;
  const inteiro = Math.round(n);
  if (inteiro < LIMITE_MIN || inteiro > LIMITE_MAX) return actual;
  return inteiro;
};

export const lerLimiteQuaseNoFim = async (): Promise<number> => {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    if (bruto === null) return LIMITE_QUASE_NO_FIM;
    return normalizarLimite(bruto);
  } catch (erro) {
    log('limite quase no fim indisponível', erro);
    return LIMITE_QUASE_NO_FIM;
  }
};

export const guardarLimiteQuaseNoFim = async (
  valor: number
): Promise<number> => {
  const limite = normalizarLimite(valor);
  try {
    await AsyncStorage.setItem(CHAVE, String(limite));
  } catch (erro) {
    log('não foi possível guardar o limite', erro);
  }
  return limite;
};
