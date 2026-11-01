import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHAVE_ANTIGA,
  CHAVE_FILA,
  VERSAO_FILA,
  carregarFila,
  gravarFila,
  lerEstadoFila,
  lerItem,
  lerItens,
  migrarItemLegado,
} from '../src/utils/fila/armazenamento';
import { aguardarAck, iniciarEnvio } from '../src/utils/fila/modelo';
import {
  VERSAO_BACKUP,
  importarFila,
  lerBackup,
  montarBackup,
} from '../src/utils/backup';

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

const AGORA = 1_700_000_000_000;

const legado = [
  { id: '1', printerId: 'p1', name: 'a.gcode', label: 'a.gcode' },
  { id: '2', printerId: 'p2', name: 'b.gcode', label: 'b.gcode' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('leitura de itens', () => {
  it('descarta registos sem id, impressora ou nome', () => {
    expect(lerItem(null)).toBeNull();
    expect(lerItem({ id: '1' })).toBeNull();
    expect(lerItem({ id: '1', printerId: 'p1' })).toBeNull();
    expect(
      lerItem({ id: '1', printerId: 'p1', name: 'a.gcode' })
    ).not.toBeNull();
  });

  it('um item incompleto nunca perde a marca de arranque tentado', () => {
    const item = lerItem({
      id: '1',
      printerId: 'p1',
      name: 'a.gcode',
      arranqueTentado: true,
      estado: 'aEsperaAck',
    });
    expect(item?.arranqueTentado).toBe(true);
    expect(item?.estado).toBe('aEsperaAck');
    expect(item?.opcoes).toEqual({ nivelar: false, lado: 0 });
  });

  it('um estado desconhecido cai em «pendente»', () => {
    const item = lerItem({
      id: '1',
      printerId: 'p1',
      name: 'a.gcode',
      estado: 'inventado',
    });
    expect(item?.estado).toBe('pendente');
  });
});

describe('migração da lista antiga', () => {
  it('converte a lista sem versão, pela ordem em que estava', () => {
    const estado = lerEstadoFila(legado, AGORA);
    expect(estado.versao).toBe(VERSAO_FILA);
    expect(estado.itens.map(i => i.id)).toEqual(['1', '2']);
    expect(estado.itens.every(i => i.estado === 'pendente')).toBe(true);
    expect(estado.itens[0].opcoes).toEqual({ nivelar: false, lado: 0 });
  });

  it('migra um item antigo com as opções com que a fila arrancava', () => {
    expect(migrarItemLegado(legado[0], AGORA)).toMatchObject({
      id: '1',
      estado: 'pendente',
      opcoes: { nivelar: false, lado: 0 },
      arranqueTentado: false,
    });
  });

  it('lê a versão nova e ignora lixo', () => {
    const estado = lerEstadoFila(
      { versao: 2, itens: [{ id: '1', printerId: 'p1', name: 'a.gcode' }] },
      AGORA
    );
    expect(estado.itens).toHaveLength(1);
    expect(lerEstadoFila('nada', AGORA).itens).toEqual([]);
    expect(lerItens({}, AGORA)).toEqual([]);
  });
});

describe('carregar e gravar', () => {
  it('guarda no esquema novo e volta a ler igual', async () => {
    const estado = lerEstadoFila(legado, AGORA);
    await gravarFila(estado.itens);
    const lido = await carregarFila(AGORA);
    expect(lido.map(i => i.id)).toEqual(['1', '2']);
    const cru = JSON.parse((await AsyncStorage.getItem(CHAVE_FILA))!);
    expect(cru.versao).toBe(VERSAO_FILA);
  });

  it('migra a chave antiga e apaga-a depois de gravar', async () => {
    await AsyncStorage.setItem(CHAVE_ANTIGA, JSON.stringify(legado));
    const lido = await carregarFila(AGORA);
    expect(lido).toHaveLength(2);
    expect(await AsyncStorage.getItem(CHAVE_ANTIGA)).toBeNull();
    expect(await AsyncStorage.getItem(CHAVE_FILA)).not.toBeNull();
  });

  it('ao abrir, um envio interrompido fica bloqueado e é gravado', async () => {
    const inicio = iniciarEnvio(
      {
        id: '1',
        printerId: 'p1',
        name: 'a.gcode',
        label: 'a.gcode',
        estado: 'pendente',
        criadoEm: AGORA,
        atualizadoEm: AGORA,
        arranqueTentado: false,
        tentativas: 0,
        opcoes: { nivelar: false, lado: 0 },
      },
      't1',
      AGORA
    );
    if (!inicio.ok) throw new Error('devia aceitar');
    const emCurso = aguardarAck(inicio.item, 't1', AGORA);
    await gravarFila([emCurso]);

    const lido = await carregarFila(AGORA + 60_000);
    expect(lido[0].estado).toBe('bloqueado');
    expect(lido[0].motivo).toBe('envioInterrompido');
    const guardado = JSON.parse((await AsyncStorage.getItem(CHAVE_FILA))!);
    expect(guardado.itens[0].estado).toBe('bloqueado');
  });

  it('fila vazia quando não há nada guardado', async () => {
    expect(await carregarFila(AGORA)).toEqual([]);
  });
});

describe('cópia de segurança', () => {
  it('leva a fila e volta a trazê-la', () => {
    const itens = lerEstadoFila(legado, AGORA).itens;
    const backup = montarBackup({
      impressoras: [{ printerName: 'Centauri', ipAddress: '10.0.0.2' }],
      preferencias: {},
      fila: itens,
      criadoEm: '2026-11-01T00:00:00.000Z',
    });
    expect(backup.versao).toBe(VERSAO_BACKUP);
    expect(backup.fila?.itens).toHaveLength(2);

    const lido = lerBackup(JSON.stringify(backup));
    expect(lido.fila?.itens).toHaveLength(2);
    const { fila, novos } = importarFila([], lido);
    expect(fila.map(i => i.id)).toEqual(['1', '2']);
    expect(novos).toBe(2);
  });

  it('um backup antigo (sem fila) continua a entrar sem erro', () => {
    const antigo = {
      versao: 3,
      criadoEm: '2026-10-01T00:00:00.000Z',
      impressoras: [{ printerName: 'Centauri', ipAddress: '10.0.0.2' }],
      preferencias: { filaAuto: false },
    };
    const lido = lerBackup(JSON.stringify(antigo));
    expect(lido.fila).toBeUndefined();
    expect(importarFila([], lido)).toEqual({ fila: [], novos: 0 });
  });

  it('não duplica itens ao importar duas vezes', () => {
    const itens = lerEstadoFila(legado, AGORA).itens;
    const backup = lerBackup(
      JSON.stringify(
        montarBackup({
          impressoras: [{ printerName: 'Centauri', ipAddress: '10.0.0.2' }],
          preferencias: {},
          fila: itens,
          criadoEm: '2026-11-01T00:00:00.000Z',
        })
      )
    );
    const primeira = importarFila([], backup);
    const segunda = importarFila(primeira.fila, backup);
    expect(segunda.fila).toHaveLength(2);
    expect(segunda.novos).toBe(0);
  });
});
