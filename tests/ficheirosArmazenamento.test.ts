import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHAVE,
  VERSAO_ESQUEMA,
  carregarFicheiros,
  gravarFicheiros,
  guardarAlternarFavorito,
  guardarArranque,
  lerRegistos,
  migrarEstado,
} from '../src/utils/ficheiros/armazenamento';
import {
  alternarFavorito,
  estadoVazio,
  marcarFavorito,
} from '../src/utils/ficheiros/modelo';

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

const alvo = { printerId: 'p1', nome: '/local/peça.gcode', tamanho: 1000 };

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('migrarEstado', () => {
  it('devolve um estado vazio para lixo', () => {
    expect(migrarEstado(null)).toEqual(estadoVazio());
    expect(migrarEstado('texto')).toEqual(estadoVazio());
    expect(migrarEstado({})).toEqual(estadoVazio());
  });

  it('lê um estado na versão actual', () => {
    const original = marcarFavorito(estadoVazio(), alvo, true);
    const lido = migrarEstado(JSON.parse(JSON.stringify(original)));
    expect(lido.versao).toBe(VERSAO_ESQUEMA);
    expect(lido.registos).toHaveLength(1);
    expect(lido.registos[0].favorito).toBe(true);
  });

  it('aceita a chave alternativa «ficheiros»', () => {
    const lido = migrarEstado({
      ficheiros: [{ printerId: 'p1', nome: '/local/a.gcode', favorito: true }],
    });
    expect(lido.registos).toHaveLength(1);
    expect(lido.registos[0].chave).toBe('p1|/local/a.gcode|');
  });

  it('descarta registos sem impressora ou sem nome', () => {
    const lido = migrarEstado({
      registos: [
        { printerId: 'p1', nome: '/local/a.gcode' },
        { nome: '/local/b.gcode' },
        { printerId: 'p2' },
        null,
        'x',
      ],
    });
    expect(lido.registos).toHaveLength(1);
  });

  it('não duplica chaves repetidas', () => {
    const lido = migrarEstado({
      registos: [
        { printerId: 'p1', nome: '/local/a.gcode' },
        { printerId: 'p1', nome: '/LOCAL/A.GCODE' },
      ],
    });
    expect(lido.registos).toHaveLength(1);
  });

  it('corrige contadores negativos e limita etiquetas', () => {
    const lido = migrarEstado({
      registos: [
        {
          printerId: 'p1',
          nome: '/local/a.gcode',
          reimpressoes: -4,
          etiquetas: Array.from({ length: 12 }, (_, i) => `e${i}`),
        },
      ],
    });
    expect(lido.registos[0].reimpressoes).toBe(0);
    expect(lido.registos[0].etiquetas).toHaveLength(8);
  });
});

describe('lerRegistos', () => {
  it('ignora o que não é uma lista', () => {
    expect(lerRegistos('nada')).toEqual([]);
    expect(lerRegistos(undefined)).toEqual([]);
  });
});

describe('carregar e gravar', () => {
  it('devolve vazio quando ainda não há nada', async () => {
    expect(await carregarFicheiros()).toEqual(estadoVazio());
  });

  it('grava e volta a ler', async () => {
    const estado = marcarFavorito(estadoVazio(), alvo, true);
    await gravarFicheiros(estado);
    const lido = await carregarFicheiros();
    expect(lido.registos[0].favorito).toBe(true);
    expect(lido.registos[0].tamanho).toBe(1000);
  });

  it('não rebenta com JSON estragado', async () => {
    await AsyncStorage.setItem(CHAVE, '{isto não é json');
    expect(await carregarFicheiros()).toEqual(estadoVazio());
  });

  it('grava sempre com a versão do esquema', async () => {
    await gravarFicheiros(estadoVazio());
    const cru = await AsyncStorage.getItem(CHAVE);
    expect(JSON.parse(cru as string).versao).toBe(VERSAO_ESQUEMA);
  });
});

describe('operações com leitura e escrita', () => {
  it('guarda o favorito e devolve o estado novo', async () => {
    const estado = await guardarAlternarFavorito(alvo);
    expect(estado.registos[0].favorito).toBe(true);
    expect((await carregarFicheiros()).registos[0].favorito).toBe(true);
  });

  it('duas operações seguidas não se atropelam', async () => {
    const primeiro = alternarFavorito(estadoVazio(), alvo);
    await gravarFicheiros(primeiro);
    const [a, b] = await Promise.all([
      guardarArranque(alvo, 'start-1'),
      guardarAlternarFavorito(alvo),
    ]);
    const final = await carregarFicheiros();
    expect(final.registos).toHaveLength(1);
    // O contador do arranque sobreviveu à alternância do favorito.
    expect(final.registos[0].reimpressoes).toBe(
      Math.max(a.registos[0].reimpressoes, b.registos[0].reimpressoes)
    );
    expect(final.registos[0].favorito).toBe(false);
  });
});
