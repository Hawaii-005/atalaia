import {
  importarFilamentos,
  lerBackup,
  montarBackup,
  VERSAO_BACKUP,
} from '../src/utils/backup';
import { estadoVazio } from '../src/utils/filamentos/armazenamento';

const impressoras = [
  {
    printerName: 'Centauri Carbon',
    ipAddress: '192.168.1.7',
    mainboardId: 'abc',
  },
];

const bobina = {
  id: 'b1',
  printerId: 'p1',
  nome: 'PLA preto',
  marca: 'Elegoo',
  material: 'PLA',
  cor: '#111111',
  pesoInicial: 1000,
  restante: 500,
  preco: 20,
  criadoEm: 1000,
};

describe('montarBackup', () => {
  it('leva impressoras, preferências e inventário', () => {
    const estado = estadoVazio();
    estado.bobinas.push(bobina);
    const backup = montarBackup({
      impressoras,
      preferencias: { filaAuto: true },
      filamentos: estado,
      criadoEm: '2026-10-31T00:00:00.000Z',
    });

    expect(backup.versao).toBe(VERSAO_BACKUP);
    expect(backup.impressoras).toHaveLength(1);
    expect(backup.preferencias).toEqual({ filaAuto: true });
    expect(backup.filamentos?.bobinas).toHaveLength(1);
    expect(backup.criadoEm).toBe('2026-10-31T00:00:00.000Z');
  });

  it('continua a gerar um backup válido sem inventário', () => {
    const backup = montarBackup({ impressoras, preferencias: {} });
    expect(backup.filamentos).toBeUndefined();
    expect(() => lerBackup(JSON.stringify(backup))).not.toThrow();
  });
});

describe('lerBackup', () => {
  it('importa um backup antigo (versão 1, sem inventário)', () => {
    const antigo = JSON.stringify({
      versao: 1,
      criadoEm: '2026-01-01T00:00:00.000Z',
      impressoras,
      preferencias: { statusIntervalMs: 5000 },
    });
    const lido = lerBackup(antigo);
    expect(lido.versao).toBe(1);
    expect(lido.impressoras[0].printerName).toBe('Centauri Carbon');
    expect(lido.filamentos).toBeUndefined();
    expect(lido.preferencias).toEqual({ statusIntervalMs: 5000 });
  });

  it('lê o inventário da versão 2', () => {
    const lido = lerBackup(
      JSON.stringify({
        versao: 2,
        impressoras,
        preferencias: {},
        filamentos: {
          bobinas: [bobina],
          garrafas: [],
          pendentes: [],
          perfis: [],
          usos: [],
        },
      })
    );
    expect(lido.filamentos?.bobinas).toHaveLength(1);
  });

  it('descarta impressoras sem nome ou sem endereço', () => {
    const lido = lerBackup(
      JSON.stringify({
        impressoras: [
          impressoras[0],
          { printerName: 'X' },
          { ipAddress: '1.2.3.4' },
        ],
      })
    );
    expect(lido.impressoras).toHaveLength(1);
  });

  it('recusa JSON inválido e ficheiros que não são backups', () => {
    expect(() => lerBackup('{nada')).toThrow();
    expect(() => lerBackup(JSON.stringify({ hello: 'world' }))).toThrow(
      /impressoras/
    );
  });
});

describe('importarFilamentos', () => {
  it('não mexe em nada quando o backup não traz inventário', () => {
    const estado = estadoVazio();
    estado.bobinas.push(bobina);
    const { estado: depois, bobinasNovas } = importarFilamentos(estado, {
      versao: 1,
      criadoEm: '2026-01-01T00:00:00.000Z',
      impressoras,
      preferencias: {},
    });
    expect(depois.bobinas).toHaveLength(1);
    expect(bobinasNovas).toBe(0);
  });

  it('acrescenta bobinas novas e conta-as', () => {
    const backup = lerBackup(
      JSON.stringify({
        versao: 2,
        impressoras,
        preferencias: {},
        filamentos: {
          bobinas: [bobina, { ...bobina, id: 'b2', nome: 'PETG' }],
          garrafas: [],
          pendentes: [],
          perfis: [],
          usos: [],
        },
      })
    );
    const { estado, bobinasNovas } = importarFilamentos(estadoVazio(), backup);
    expect(estado.bobinas).toHaveLength(2);
    expect(bobinasNovas).toBe(2);
  });

  it('um id repetido é substituído pelo do backup, sem duplicar', () => {
    const actual = estadoVazio();
    actual.bobinas.push({ ...bobina, restante: 999 });
    const backup = lerBackup(
      JSON.stringify({
        versao: 2,
        impressoras,
        preferencias: {},
        filamentos: {
          bobinas: [bobina],
          garrafas: [],
          pendentes: [],
          perfis: [],
          usos: [],
        },
      })
    );
    const { estado, bobinasNovas } = importarFilamentos(actual, backup);
    expect(bobinasNovas).toBe(0);
    expect(estado.bobinas).toHaveLength(1);
    expect(estado.bobinas[0].restante).toBe(500);
  });

  it('não perde garrafas e pendentes que já existiam', () => {
    const actual = estadoVazio();
    actual.garrafas.push({
      id: 'g1',
      printerId: 's1',
      nome: 'Resina',
      cor: '#222222',
      volumeInicial: 1000,
      preco: 30,
      restante: 800,
      criadoEm: 1,
    });
    const backup = lerBackup(
      JSON.stringify({
        versao: 2,
        impressoras,
        preferencias: {},
        filamentos: {
          bobinas: [bobina],
          garrafas: [],
          pendentes: [],
          perfis: [],
          usos: [],
        },
      })
    );
    const { estado } = importarFilamentos(actual, backup);
    expect(estado.garrafas.map(g => g.id)).toEqual(['g1']);
    expect(estado.bobinas).toHaveLength(1);
  });
});
