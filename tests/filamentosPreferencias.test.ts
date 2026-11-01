import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LIMITE_MAX,
  LIMITE_MIN,
  guardarLimiteQuaseNoFim,
  lerLimiteQuaseNoFim,
  normalizarLimite,
} from '../src/utils/filamentos/preferencias';
import { LIMITE_QUASE_NO_FIM } from '../src/utils/filamentos/modelo';

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

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('normalizarLimite', () => {
  it('aceita inteiros dentro do intervalo', () => {
    expect(normalizarLimite(10)).toBe(10);
    expect(normalizarLimite('20')).toBe(20);
    expect(normalizarLimite(LIMITE_MIN)).toBe(LIMITE_MIN);
    expect(normalizarLimite(LIMITE_MAX)).toBe(LIMITE_MAX);
  });

  it('arredonda decimais', () => {
    expect(normalizarLimite(15.5)).toBe(16);
    expect(normalizarLimite('12,4')).toBe(12);
  });

  it('recusa o que está fora do intervalo ou não é número', () => {
    expect(normalizarLimite(0)).toBe(LIMITE_QUASE_NO_FIM);
    expect(normalizarLimite(-5)).toBe(LIMITE_QUASE_NO_FIM);
    expect(normalizarLimite(51)).toBe(LIMITE_QUASE_NO_FIM);
    expect(normalizarLimite('muito')).toBe(LIMITE_QUASE_NO_FIM);
    expect(normalizarLimite(null)).toBe(LIMITE_QUASE_NO_FIM);
    expect(normalizarLimite(Number.NaN)).toBe(LIMITE_QUASE_NO_FIM);
  });

  it('usa o valor actual como recurso', () => {
    expect(normalizarLimite(999, 25)).toBe(25);
  });
});

describe('preferência guardada', () => {
  it('devolve o valor por omissão quando não há nada guardado', async () => {
    await expect(lerLimiteQuaseNoFim()).resolves.toBe(LIMITE_QUASE_NO_FIM);
  });

  it('guarda e volta a ler', async () => {
    await guardarLimiteQuaseNoFim(25);
    await expect(lerLimiteQuaseNoFim()).resolves.toBe(25);
  });

  it('não guarda um valor inválido (fica o de omissão)', async () => {
    await guardarLimiteQuaseNoFim(80);
    await expect(lerLimiteQuaseNoFim()).resolves.toBe(LIMITE_QUASE_NO_FIM);
  });

  it('sobrevive a um valor corrompido no armazenamento', async () => {
    await AsyncStorage.setItem('atalaia.filamentos.limiteQuaseNoFim', 'lixo');
    await expect(lerLimiteQuaseNoFim()).resolves.toBe(LIMITE_QUASE_NO_FIM);
  });
});
