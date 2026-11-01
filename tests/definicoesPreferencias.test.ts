import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHAVE_POTENCIA_W,
  CHAVE_PRECO_KWH,
  KWH_MAX,
  KWH_OMISSAO,
  POTENCIA_MAX,
  POTENCIA_OMISSAO,
  custoEnergetico,
  guardarPotenciaW,
  guardarPrecoKwh,
  lerPotenciaW,
  lerPrecoKwh,
  normalizarDecimal,
  lerPreferenciasDeBackup,
} from '../src/utils/definicoes/preferencias';

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

const LIMITES_KWH = { min: 0, max: KWH_MAX, omissao: KWH_OMISSAO };

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('normalizarDecimal', () => {
  it('aceita vírgula e arredonda a duas casas', () => {
    expect(normalizarDecimal('0,1549', LIMITES_KWH)).toBe(0.15);
    expect(normalizarDecimal('0.2', LIMITES_KWH)).toBe(0.2);
    expect(normalizarDecimal(0.234, LIMITES_KWH)).toBe(0.23);
  });

  it('recusa fora do intervalo e lixo', () => {
    expect(normalizarDecimal(-1, LIMITES_KWH)).toBe(KWH_OMISSAO);
    expect(normalizarDecimal(KWH_MAX + 1, LIMITES_KWH)).toBe(KWH_OMISSAO);
    expect(normalizarDecimal('muito', LIMITES_KWH)).toBe(KWH_OMISSAO);
    expect(normalizarDecimal(null, LIMITES_KWH)).toBe(KWH_OMISSAO);
    expect(normalizarDecimal(Number.NaN, LIMITES_KWH)).toBe(KWH_OMISSAO);
  });

  it('usa o valor actual como recurso', () => {
    expect(normalizarDecimal(999, LIMITES_KWH, 0.2)).toBe(0.2);
  });
});

describe('preço do kWh', () => {
  it('vem a zero quando nunca foi preenchido', async () => {
    await expect(lerPrecoKwh()).resolves.toBe(KWH_OMISSAO);
  });

  it('guarda e volta a ler', async () => {
    await guardarPrecoKwh(0.19);
    await expect(lerPrecoKwh()).resolves.toBe(0.19);
    await expect(AsyncStorage.getItem(CHAVE_PRECO_KWH)).resolves.toBe('0.19');
  });

  it('não guarda valores impossíveis', async () => {
    await guardarPrecoKwh(99);
    await expect(lerPrecoKwh()).resolves.toBe(KWH_OMISSAO);
  });

  it('sobrevive a um valor corrompido', async () => {
    await AsyncStorage.setItem(CHAVE_PRECO_KWH, 'lixo');
    await expect(lerPrecoKwh()).resolves.toBe(KWH_OMISSAO);
  });
});

describe('potência da impressora', () => {
  it('vem a zero quando nunca foi preenchida', async () => {
    await expect(lerPotenciaW()).resolves.toBe(POTENCIA_OMISSAO);
  });

  it('guarda e volta a ler', async () => {
    await guardarPotenciaW(350);
    await expect(lerPotenciaW()).resolves.toBe(350);
    await expect(AsyncStorage.getItem(CHAVE_POTENCIA_W)).resolves.toBe('350');
  });

  it('recusa acima do tecto', async () => {
    await guardarPotenciaW(POTENCIA_MAX + 1);
    await expect(lerPotenciaW()).resolves.toBe(POTENCIA_OMISSAO);
  });
});

describe('custoEnergetico', () => {
  it('calcula kWh × preço', () => {
    // 350 W durante 2 h = 0,7 kWh × 0,19 € = 0,13 €
    expect(custoEnergetico(2, 350, 0.19)).toBe(0.13);
  });

  it('devolve 0 quando falta um dos valores', () => {
    expect(custoEnergetico(2, 0, 0.19)).toBe(0);
    expect(custoEnergetico(2, 350, 0)).toBe(0);
    expect(custoEnergetico(0, 350, 0.19)).toBe(0);
    expect(custoEnergetico(-1, 350, 0.19)).toBe(0);
  });
});

describe('lerPreferenciasDeBackup', () => {
  it('aceita valores válidos de uma cópia de segurança', () => {
    expect(
      lerPreferenciasDeBackup({
        statusIntervalMs: 60000,
        filaAuto: true,
        limiteQuaseNoFim: 20,
        precoKwh: 0.17,
        potenciaW: 350,
      })
    ).toEqual({
      statusIntervalMs: 60000,
      filaAuto: true,
      limiteQuaseNoFim: 20,
      precoKwh: 0.17,
      potenciaW: 350,
    });
  });

  it('ignora campos ausentes, com tipo errado ou fora de limites', () => {
    expect(
      lerPreferenciasDeBackup({
        statusIntervalMs: 45000,
        filaAuto: 'sim',
        limiteQuaseNoFim: 99,
        precoKwh: -1,
        potenciaW: 9000,
      })
    ).toEqual({});
  });

  it('mantém o que é válido e descarta o resto', () => {
    expect(
      lerPreferenciasDeBackup({
        statusIntervalMs: 31000,
        filaAuto: false,
        limiteQuaseNoFim: 12.6,
        precoKwh: '0,25',
      })
    ).toEqual({
      statusIntervalMs: 31000,
      filaAuto: false,
      limiteQuaseNoFim: 13,
      precoKwh: 0.25,
    });
  });

  it('não rebenta com objetos antigos sem preferências', () => {
    expect(lerPreferenciasDeBackup({})).toEqual({});
  });
});
