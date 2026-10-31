/**
 * Preço do filamento, para estimar o custo de uma peça.
 * Fica guardado no telemóvel (AsyncStorage) e em cache para não haver idas ao
 * disco a cada abertura do ecrã de detalhe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localeActual } from '../i18n';

const CHAVE = 'precoKgFilamento';

let cache: number | null = null;

export const getPrecoKg = async (): Promise<number> => {
  if (cache !== null) return cache;
  try {
    const guardado = await AsyncStorage.getItem(CHAVE);
    const valor = guardado ? Number.parseFloat(guardado.replace(',', '.')) : 0;
    cache = Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch {
    cache = 0;
  }
  return cache;
};

export const setPrecoKg = async (valor: number): Promise<void> => {
  const limpo = Number.isFinite(valor) && valor > 0 ? valor : 0;
  cache = limpo;
  try {
    await AsyncStorage.setItem(CHAVE, String(limpo));
  } catch {
    // Sem persistência o valor continua válido nesta sessão.
  }
};

/** Custo em euros para um dado peso, com o preço por quilo. */
export const custoDe = (gramas: number, precoKg: number): number =>
  precoKg > 0 ? (gramas / 1000) * precoKg : 0;

/** A moeda mantém-se em euros; a apresentação segue o idioma escolhido. */
export const euros = (valor: number): string =>
  new Intl.NumberFormat(localeActual(), {
    style: 'currency',
    currency: 'EUR',
  }).format(valor);
