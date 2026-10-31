import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import pt from './pt';
import en from './en';
import es from './es';
import fr from './fr';
import de from './de';
import it from './it';
import nl from './nl';
import pl from './pl';
import ja from './ja';
import zh from './zh';
import {
  IDIOMAS,
  Idioma,
  PreferenciaIdioma,
  isPreferenciaIdioma,
  resolverIdioma,
} from './language';

export { IDIOMAS } from './language';
export type { Idioma, PreferenciaIdioma } from './language';

const STORAGE_KEY = 'languagePreference';
const tabelas: Record<Idioma, Record<string, string>> = {
  pt,
  en,
  es,
  fr,
  de,
  it,
  nl,
  pl,
  ja,
  zh,
};
const idiomaDoTelefone = () =>
  resolverIdioma(getLocales().map(locale => locale.languageTag));
let estado: { preferencia: PreferenciaIdioma; idioma: Idioma } = {
  preferencia: 'system',
  idioma: idiomaDoTelefone(),
};
const listeners = new Set<() => void>();

const publicar = (preferencia: PreferenciaIdioma) => {
  const idioma = preferencia === 'system' ? idiomaDoTelefone() : preferencia;
  if (estado.preferencia === preferencia && estado.idioma === idioma) return;
  estado = { preferencia, idioma };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => estado;

export const useIdioma = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const localeActual = () =>
  IDIOMAS.find(item => item.id === estado.idioma)!.locale;

export const inicializarIdioma = async () => {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved !== null && !isPreferenciaIdioma(saved)) {
    throw new Error('Invalid saved language preference');
  }
  publicar(saved ?? 'system');
};

export const definirPreferenciaIdioma = async (
  preferencia: PreferenciaIdioma
) => {
  if (!isPreferenciaIdioma(preferencia)) {
    throw new Error('Invalid language preference');
  }
  await AsyncStorage.setItem(STORAGE_KEY, preferencia);
  publicar(preferencia);
};

export const atualizarIdiomaDoSistema = () => publicar(estado.preferencia);

export const t = (
  chave: string,
  params?: Record<string, string | number>
): string => {
  const valor = tabelas[estado.idioma][chave] ?? tabelas.en[chave];
  if (valor === undefined) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[i18n] missing translation: ${chave}`);
    }
    return chave;
  }
  return valor.replace(/\{([^{}]+)\}/g, (match, nome: string) =>
    params?.[nome] === undefined ? match : String(params[nome])
  );
};
