export const IDIOMAS = [
  { id: 'en', nome: 'English', locale: 'en-US' },
  { id: 'pt', nome: 'Português', locale: 'pt-PT' },
  { id: 'es', nome: 'Español', locale: 'es-ES' },
  { id: 'fr', nome: 'Français', locale: 'fr-FR' },
  { id: 'de', nome: 'Deutsch', locale: 'de-DE' },
  { id: 'it', nome: 'Italiano', locale: 'it-IT' },
  { id: 'nl', nome: 'Nederlands', locale: 'nl-NL' },
  { id: 'pl', nome: 'Polski', locale: 'pl-PL' },
  { id: 'ja', nome: '日本語', locale: 'ja-JP' },
  { id: 'zh', nome: '简体中文', locale: 'zh-CN' },
] as const;

export type Idioma = (typeof IDIOMAS)[number]['id'];
export type PreferenciaIdioma = Idioma | 'system';

export const isPreferenciaIdioma = (
  value: unknown
): value is PreferenciaIdioma =>
  value === 'system' || IDIOMAS.some(item => item.id === value);

export const resolverIdioma = (locales: readonly string[]): Idioma => {
  for (const locale of locales) {
    const base = locale.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    const supported = IDIOMAS.find(item => item.id === base);
    if (supported) return supported.id;
  }
  return 'en';
};
