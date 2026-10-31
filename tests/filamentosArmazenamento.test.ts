import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHAVE,
  CHAVE_LEGADA,
  carregarEstado,
  guardarEstado,
  migrarEstado,
  VERSAO_ESQUEMA,
} from '../src/utils/filamentos/armazenamento';

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

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

const legado = {
  rolos: [
    {
      id: 'r1',
      printerId: 'p1',
      nome: 'PLA preto',
      material: 'pla',
      cor: '#111111',
      pesoInicial: 1000,
      preco: 20,
      restante: 640.5,
      criadoEm: 1000,
    },
  ],
  garrafas: [
    {
      id: 'g1',
      printerId: 's1',
      nome: 'Resina',
      cor: '#222222',
      volumeInicial: 1000,
      preco: 30,
      restante: 800,
      criadoEm: 2000,
    },
  ],
  pendentes: [
    {
      id: 'c1',
      printerId: 'p1',
      filename: '/local/a.gcode',
      quando: 3000,
      gramas: null,
    },
  ],
};

describe('migrarEstado', () => {
  it('converte os rolos da v1 em bobinas, sem perder garrafas nem pendentes', () => {
    const estado = migrarEstado(legado);
    expect(estado.versao).toBe(VERSAO_ESQUEMA);
    expect(estado.bobinas).toHaveLength(1);
    expect(estado.bobinas[0]).toMatchObject({
      id: 'r1',
      nome: 'PLA preto',
      material: 'PLA',
      pesoInicial: 1000,
      restante: 640.5,
      preco: 20,
    });
    expect(estado.garrafas[0].id).toBe('g1');
    expect(estado.pendentes[0].gramas).toBeNull();
    expect(estado.perfis).toEqual([]);
    expect(estado.usos).toEqual([]);
  });

  it('prefere `bobinas` a `rolos` quando existem os dois', () => {
    const estado = migrarEstado({
      bobinas: [{ ...legado.rolos[0], id: 'novo' }],
      rolos: legado.rolos,
    });
    expect(estado.bobinas.map(b => b.id)).toEqual(['novo']);
  });

  it('devolve um estado vazio para lixo', () => {
    expect(migrarEstado(null).bobinas).toEqual([]);
    expect(migrarEstado('nada').bobinas).toEqual([]);
    expect(migrarEstado({}).bobinas).toEqual([]);
  });

  it('descarta bobinas sem id ou sem impressora', () => {
    const estado = migrarEstado({
      bobinas: [
        { id: '', printerId: 'p1' },
        { id: 'x' },
        { id: 'ok', printerId: 'p1', pesoInicial: 500 },
      ],
    });
    expect(estado.bobinas.map(b => b.id)).toEqual(['ok']);
  });

  it('corrige valores impossíveis', () => {
    const estado = migrarEstado({
      bobinas: [
        {
          id: 'x',
          printerId: 'p1',
          pesoInicial: 500,
          restante: 900,
          preco: -4,
          cor: 'roxo',
          canvasSlot: 9,
        },
      ],
    });
    const bobina = estado.bobinas[0];
    expect(bobina.restante).toBe(500);
    expect(bobina.preco).toBe(0);
    expect(bobina.cor).toBe('#808080');
    expect(bobina.canvasSlot).toBeUndefined();
  });
});

describe('carregarEstado', () => {
  it('devolve vazio quando não há nada guardado', async () => {
    const estado = await carregarEstado();
    expect(estado).toEqual({
      versao: VERSAO_ESQUEMA,
      bobinas: [],
      garrafas: [],
      pendentes: [],
      perfis: [],
      usos: [],
    });
  });

  it('migra a chave antiga, grava a nova e não apaga a antiga', async () => {
    await AsyncStorage.setItem(CHAVE_LEGADA, JSON.stringify(legado));
    const estado = await carregarEstado();
    expect(estado.bobinas).toHaveLength(1);

    const gravado = await AsyncStorage.getItem(CHAVE);
    expect(gravado).not.toBeNull();
    expect(JSON.parse(gravado as string).versao).toBe(VERSAO_ESQUEMA);
    // A chave antiga fica intacta para poder voltar atrás.
    expect(await AsyncStorage.getItem(CHAVE_LEGADA)).toBe(
      JSON.stringify(legado)
    );
  });

  it('lê a v2 sem voltar a migrar', async () => {
    await AsyncStorage.setItem(
      CHAVE,
      JSON.stringify({
        versao: 2,
        bobinas: [
          {
            id: 'b1',
            printerId: 'p1',
            nome: 'PETG',
            pesoInicial: 750,
            restante: 100,
          },
        ],
      })
    );
    await AsyncStorage.setItem(CHAVE_LEGADA, JSON.stringify(legado));
    const estado = await carregarEstado();
    expect(estado.bobinas.map(b => b.id)).toEqual(['b1']);
  });

  it('sobrevive a um JSON corrompido', async () => {
    await AsyncStorage.setItem(CHAVE, '{isto não é json');
    const estado = await carregarEstado();
    expect(estado.bobinas).toEqual([]);
  });
});

describe('guardarEstado', () => {
  it('grava sempre com a versão actual do esquema', async () => {
    await guardarEstado({
      versao: 1,
      bobinas: [],
      garrafas: [],
      pendentes: [],
      perfis: [],
      usos: [],
    });
    const gravado = JSON.parse((await AsyncStorage.getItem(CHAVE)) as string);
    expect(gravado.versao).toBe(VERSAO_ESQUEMA);
  });
});
