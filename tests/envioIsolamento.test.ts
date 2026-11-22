/**
 * Guarda de arquitetura: `src/envio/` tem de poder ser compilado na variante
 * lite (MIT), sem o fatiador nem o módulo nativo dele. Este teste falha se
 * alguém importar React Native, o `fetch` ou a ponte do fatiador para aqui.
 */

import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, '..', 'src', 'envio');

const PROIBIDOS: [RegExp, string][] = [
  [/from\s+['"][^'"]*react-native/, 'importa react-native'],
  [/from\s+['"][^'"]*fatiador\/ponte/, 'importa a ponte nativa do fatiador'],
  [/from\s+['"][^'"]*fatiador\//, 'importa código do fatiador'],
  [/\brequire\s*\(\s*['"]react-native/, 'require de react-native'],
  [/\bfetch\s*\(/, 'chama fetch (a rede é do adaptador, não daqui)'],
  [/NativeModules/, 'usa NativeModules'],
  [/XMLHttpRequest/, 'usa XMLHttpRequest'],
];

describe('src/envio é independente do fatiador', () => {
  const ficheiros = fs
    .readdirSync(DIR)
    .filter(nome => nome.endsWith('.ts'))
    .sort();

  test('há ficheiros para verificar', () => {
    expect(ficheiros.length).toBeGreaterThan(0);
  });

  test.each(ficheiros)(
    '%s não depende de RN, fetch nem do fatiador',
    (nome: string) => {
      const texto = fs.readFileSync(path.join(DIR, nome), 'utf8');
      for (const [padrao, motivo] of PROIBIDOS) {
        expect({ nome, motivo, encontrado: padrao.test(texto) }).toEqual({
          nome,
          motivo,
          encontrado: false,
        });
      }
    }
  );
});
