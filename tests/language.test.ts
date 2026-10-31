import React, { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales, Locale } from 'expo-localization';
import {
  IDIOMAS,
  atualizarIdiomaDoSistema,
  definirPreferenciaIdioma,
  inicializarIdioma,
  localeActual,
  t,
  useIdioma,
} from '../src/i18n';
import { resolverIdioma } from '../src/i18n/language';
import { euros } from '../src/utils/precos';
import en from '../src/i18n/en';
import pt from '../src/i18n/pt';
import es from '../src/i18n/es';
import fr from '../src/i18n/fr';
import de from '../src/i18n/de';
import italian from '../src/i18n/it';
import nl from '../src/i18n/nl';
import pl from '../src/i18n/pl';
import ja from '../src/i18n/ja';
import zh from '../src/i18n/zh';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    clear: jest.fn(async () => values.clear()),
  };
});
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => []),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const dictionaries = { en, pt, es, fr, de, it: italian, nl, pl, ja, zh };
let rendered: ReactTestRenderer | undefined;

const setPhoneLanguages = (...tags: string[]) => {
  const locales: Locale[] = tags.map(languageTag => ({
    languageTag,
    languageCode: languageTag.split('-')[0],
    languageScriptCode: null,
    regionCode: null,
    languageRegionCode: null,
    currencyCode: null,
    currencySymbol: null,
    languageCurrencyCode: null,
    languageCurrencySymbol: null,
    decimalSeparator: null,
    digitGroupingSeparator: null,
    textDirection: 'ltr',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
  }));
  jest.mocked(getLocales).mockReturnValue(locales);
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setPhoneLanguages('en-US');
  await inicializarIdioma();
});

afterEach(async () => {
  if (rendered) {
    await act(async () => rendered?.unmount());
    rendered = undefined;
  }
});

describe('phone language resolution', () => {
  it.each([
    [['pt-BR'], 'pt'],
    [['ES_mx'], 'es'],
    [['zh-Hans-CN'], 'zh'],
    [['ja-JP'], 'ja'],
    [['ar-SA', 'de-CH'], 'de'],
    [['ar-SA'], 'en'],
    [[], 'en'],
  ])('resolves %j to %s', (locales, expected) => {
    expect(resolverIdioma(locales)).toBe(expected);
  });

  it('uses the phone by default without saving an override', async () => {
    setPhoneLanguages('pt-BR');
    await inicializarIdioma();
    expect(t('settings.title')).toBe(pt['settings.title']);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('saved language selection', () => {
  it('restores a saved language instead of the phone language', async () => {
    await AsyncStorage.setItem('languagePreference', 'es');
    await inicializarIdioma();
    expect(t('settings.title')).toBe(es['settings.title']);
    expect(localeActual()).toBe('es-ES');
  });

  it('follows phone changes only when the system option is selected', async () => {
    await definirPreferenciaIdioma('en');
    setPhoneLanguages('de-DE');
    atualizarIdiomaDoSistema();
    expect(t('settings.title')).toBe(en['settings.title']);
    await definirPreferenciaIdioma('system');
    expect(t('settings.title')).toBe(de['settings.title']);
    setPhoneLanguages('es-MX');
    atualizarIdiomaDoSistema();
    expect(t('settings.title')).toBe(es['settings.title']);
    expect(await AsyncStorage.getItem('languagePreference')).toBe('system');
  });

  it('keeps the existing language when saving fails', async () => {
    jest
      .mocked(AsyncStorage.setItem)
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(definirPreferenciaIdioma('pt')).rejects.toThrow('disk full');
    expect(t('settings.title')).toBe(en['settings.title']);
    expect(await AsyncStorage.getItem('languagePreference')).toBeNull();
  });

  it('reports an invalid saved preference rather than silently overwriting it', async () => {
    await AsyncStorage.setItem('languagePreference', 'unknown');
    await expect(inicializarIdioma()).rejects.toThrow('Invalid saved language');
    expect(await AsyncStorage.getItem('languagePreference')).toBe('unknown');
  });

  it('reports storage read failures and leaves phone-default rendering available', async () => {
    jest
      .mocked(AsyncStorage.getItem)
      .mockRejectedValueOnce(new Error('read failed'));
    await expect(inicializarIdioma()).rejects.toThrow('read failed');
    expect(t('settings.title')).toBe(en['settings.title']);
  });

  it('updates mounted consumers immediately without remounting their state', async () => {
    let mounts = 0;
    const Label = () => {
      useIdioma();
      useEffect(() => {
        mounts += 1;
      }, []);
      return React.createElement('label', null, t('settings.title'));
    };
    await act(async () => {
      rendered = create(React.createElement(Label));
    });
    expect(rendered?.toJSON()).toMatchObject({
      children: [en['settings.title']],
    });
    await act(async () => {
      await definirPreferenciaIdioma('es');
    });
    expect(rendered?.toJSON()).toMatchObject({
      children: [es['settings.title']],
    });
    expect(mounts).toBe(1);
    expect(await AsyncStorage.getItem('languagePreference')).toBe('es');
  });

  it('updates numeric formatting without changing the currency', async () => {
    expect(euros(19.9)).toContain('19.90');
    await definirPreferenciaIdioma('pt');
    expect(euros(19.9)).toContain('19,90');
    expect(euros(19.9)).toContain('€');
  });
});

describe('translation coverage', () => {
  it.each(IDIOMAS)(
    '$nome has every key and preserves interpolation parameters',
    ({ id }) => {
      const dictionary = dictionaries[id];
      expect(Object.keys(dictionary).sort()).toEqual(Object.keys(pt).sort());
      const placeholders = (value: string) =>
        (value.match(/\{[^{}]+\}/g) ?? []).sort();
      for (const key of Object.keys(pt) as (keyof typeof pt)[]) {
        expect({ key, parameters: placeholders(dictionary[key]) }).toEqual({
          key,
          parameters: placeholders(pt[key]),
        });
      }
    }
  );

  it('treats replacement strings literally, including dollar signs and braces', () => {
    expect(
      t('notifications.completedBody', {
        nome: '$& printer',
        ficheiro: '$1 {nome}.gcode',
      })
    ).toBe('$& printer completed $1 {nome}.gcode.');
  });
});
