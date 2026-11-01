import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHAVE_CACHE,
  IDADE_MAXIMA_MS,
  apagarCache,
  carregarCache,
  guardarCache,
  idadeEmPartes,
  lerCacheGuardada,
} from '../src/utils/ficheiros/cache';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      values.delete(key);
    }),
    clear: jest.fn(async () => values.clear()),
  };
});

const ficheiros = [
  { name: '/local/a.gcode', FileSize: 100, CreateTime: 5 },
  { name: '/local/b.gcode', FileSize: 200 },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('guardar e ler', () => {
  it('devolve null quando não há cache', async () => {
    expect(await carregarCache('p1')).toBeNull();
  });

  it('guarda e devolve a lista da mesma impressora', async () => {
    await guardarCache('p1', ficheiros);
    const cache = await carregarCache('p1');
    expect(cache?.ficheiros.map(f => f.name)).toEqual([
      '/local/a.gcode',
      '/local/b.gcode',
    ]);
    expect(cache?.antiga).toBe(false);
  });

  it('não devolve a lista de outra impressora', async () => {
    await guardarCache('p1', ficheiros);
    expect(await carregarCache('p2')).toBeNull();
  });

  it('calcula a idade a partir da hora de gravação', async () => {
    const gravado = new Date('2026-11-01T08:00:00.000Z');
    await guardarCache('p1', ficheiros, gravado);
    const cache = await carregarCache(
      'p1',
      new Date('2026-11-01T10:30:00.000Z')
    );
    expect(cache?.idadeMs).toBe(2.5 * 60 * 60 * 1000);
    expect(cache?.antiga).toBe(true);
  });

  it('esquece listas demasiado antigas', async () => {
    const gravado = new Date('2026-11-01T08:00:00.000Z');
    await guardarCache('p1', ficheiros, gravado);
    const agora = new Date(gravado.getTime() + IDADE_MAXIMA_MS + 1000);
    expect(await carregarCache('p1', agora)).toBeNull();
  });

  it('apaga a cache', async () => {
    await guardarCache('p1', ficheiros);
    await apagarCache();
    expect(await carregarCache('p1')).toBeNull();
  });

  it('não rebenta com JSON estragado', async () => {
    await AsyncStorage.setItem(CHAVE_CACHE, 'não é json');
    expect(await carregarCache('p1')).toBeNull();
  });
});

describe('lerCacheGuardada', () => {
  it('descarta entradas sem nome e repetidas', () => {
    const lida = lerCacheGuardada({
      impressoraId: 'p1',
      guardadoEm: '2026-11-01T08:00:00.000Z',
      ficheiros: [
        { name: '/local/a.gcode' },
        { name: '/local/a.gcode' },
        { name: '' },
        { semNome: true },
        null,
      ],
    });
    expect(lida?.ficheiros).toHaveLength(1);
  });

  it('exige impressora e data válidas', () => {
    expect(lerCacheGuardada({ ficheiros: [] })).toBeNull();
    expect(lerCacheGuardada({ impressoraId: 'p1', ficheiros: [] })).toBeNull();
    expect(
      lerCacheGuardada({
        impressoraId: 'p1',
        guardadoEm: 'x',
        ficheiros: 'nada',
      })
    ).toBeNull();
  });
});

describe('idadeEmPartes', () => {
  it('devolve null para agora', () => {
    expect(idadeEmPartes(30_000)).toBeNull();
    expect(idadeEmPartes(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('minutos, horas e dias', () => {
    expect(idadeEmPartes(5 * 60_000)).toEqual({ unidade: 'min', valor: 5 });
    expect(idadeEmPartes(3 * 3_600_000)).toEqual({ unidade: 'h', valor: 3 });
    expect(idadeEmPartes(50 * 3_600_000)).toEqual({ unidade: 'dia', valor: 2 });
  });
});
