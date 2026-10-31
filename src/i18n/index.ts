/** I18n mínimo, sem dependências: escolhe o idioma no arranque a partir do
 * telemóvel e resolve chaves de texto nos dicionários `pt.ts` / `en.ts`. */
import { NativeModules } from 'react-native';
import pt from './pt';
import en from './en';

export type Idioma = 'pt' | 'en';

// Descobre o idioma do telemóvel, por ordem de fiabilidade:
// 1) identificador nativo (Android e iOS costumam devolver 'pt_PT'/'pt-PT');
// 2) locale resolvido pela API Intl;
// 3) inglês como último recurso.
const resolverIdioma = (): Idioma => {
  const nativo = NativeModules.I18nManager?.localeIdentifier as
    | string
    | undefined;
  const intl = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      return '';
    }
  })();

  for (const candidato of [nativo, intl]) {
    if (candidato && candidato.toLowerCase().startsWith('pt')) {
      return 'pt';
    }
  }
  return 'en';
};

/** Idioma calculado uma vez no arranque. */
export const idiomaActual: Idioma = resolverIdioma();

let idiomCorrente: Idioma = idiomaActual;

/** Troca o idioma em execução (para uso futuro nas Definições). */
export const definirIdioma = (id: Idioma) => {
  idiomCorrente = id;
};

const tabelas: Record<string, Record<string, string>> = {
  pt: pt as Record<string, string>,
  en: en as Record<string, string>,
};

/** Devolve o texto da chave, com `{nome}` substituído por `params.nome`.
 * Em desenvolvimento avisa e devolve a própria chave se esta não existir. */
export const t = (
  chave: string,
  params?: Record<string, string | number>
): string => {
  // Se a chave não existir no idioma corrente, cai para português em vez de
  // mostrar a chave crua ao utilizador.
  let valor = tabelas[idiomCorrente]?.[chave];
  if (valor === undefined && idiomCorrente !== 'pt') {
    valor = tabelas.pt?.[chave];
  }
  if (valor === undefined) {
    if (__DEV__) {
      console.warn(`[i18n] chave em falta: ${chave}`);
    }
    return chave;
  }
  if (params) {
    for (const [nome, substituto] of Object.entries(params)) {
      valor = valor.replace(
        new RegExp(`\\{${nome}\\}`, 'g'),
        String(substituto)
      );
    }
  }
  return valor;
};

// Verificação simples: ambas as tabelas devem ter exactamente as mesmas chaves.
if (__DEV__) {
  const chavesPt = Object.keys(pt).sort();
  const chavesEn = Object.keys(en).sort();
  if (chavesPt.join('|') !== chavesEn.join('|')) {
    console.warn(
      '[i18n] as tabelas pt/en não têm as mesmas chaves',
      chavesPt.filter(k => !chavesEn.includes(k)),
      chavesEn.filter(k => !chavesPt.includes(k))
    );
  }
}
