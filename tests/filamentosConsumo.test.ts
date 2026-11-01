import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  carregarInventario,
  confirmarConsumo,
  lerConsumoDoGcode,
  lerPesoDoGcode,
  registarConsumo,
  registarConsumoPorSlot,
} from '../src/utils/inventario';
import {
  carregarEstado,
  guardarEstado,
} from '../src/utils/filamentos/armazenamento';
import { criarBobina } from '../src/utils/filamentos/operacoes';

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

describe('Consumo e Idempotência de Filamentos (Fase 5)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('desconta consumo multi-material nos respectivos slots (A1 e A2) e gera registos de uso', async () => {
    const b0 = criarBobina({
      nome: 'Bobina Slot 0',
      material: 'PLA',
      cor: '#ff0000',
      pesoInicial: 1000,
      preco: 20,
      printerId: 'printer-1',
      canvasSlot: 0,
    });
    const b1 = criarBobina({
      nome: 'Bobina Slot 1',
      material: 'PETG',
      cor: '#00ff00',
      pesoInicial: 1000,
      preco: 30,
      printerId: 'printer-1',
      canvasSlot: 1,
    });

    await guardarEstado({
      versao: 2,
      bobinas: [b0, b1],
      garrafas: [],
      pendentes: [],
      perfis: [],
      usos: [],
    });

    // Registar consumo multi-material: 15g no slot 0, 25g no slot 1
    await registarConsumo(
      'printer-1',
      '192.168.1.50',
      'multi.gcode',
      [
        { slot: 0, gramas: 15 },
        { slot: 1, gramas: 25 },
      ],
      'task-job-1'
    );

    const estado = await carregarEstado();
    const bobina0 = estado.bobinas.find(b => b.id === b0.id);
    const bobina1 = estado.bobinas.find(b => b.id === b1.id);

    expect(bobina0?.restante).toBe(985);
    expect(bobina1?.restante).toBe(975);

    expect(estado.usos).toHaveLength(2);
    expect(estado.usos[0]).toMatchObject({
      jobId: 'task-job-1',
      printerId: 'printer-1',
      spoolId: b0.id,
      gramas: 15,
      custo: 0.3, // 15g * 0.02€
    });
    expect(estado.usos[1]).toMatchObject({
      jobId: 'task-job-1',
      printerId: 'printer-1',
      spoolId: b1.id,
      gramas: 25,
      custo: 0.75, // 25g * 0.03€
    });
  });

  it('é idempotente por TaskId: não duplica desconto para a mesma tarefa', async () => {
    const b0 = criarBobina({
      nome: 'Bobina Slot 0',
      material: 'PLA',
      cor: '#ff0000',
      pesoInicial: 1000,
      preco: 20,
      printerId: 'printer-1',
      canvasSlot: 0,
    });

    await guardarEstado({
      versao: 2,
      bobinas: [b0],
      garrafas: [],
      pendentes: [],
      perfis: [],
      usos: [],
    });

    // Primeira chamada com task-999
    await registarConsumo(
      'printer-1',
      '192.168.1.50',
      'peca.gcode',
      50,
      'task-999'
    );

    let estado = await carregarEstado();
    expect(estado.bobinas[0].restante).toBe(950);
    expect(estado.usos).toHaveLength(1);

    // Segunda chamada repetida com o mesmo task-999 (ex: reconnect ou re-render)
    await registarConsumo(
      'printer-1',
      '192.168.1.50',
      'peca.gcode',
      50,
      'task-999'
    );

    estado = await carregarEstado();
    // Permanece 950g e 1 uso registado
    expect(estado.bobinas[0].restante).toBe(950);
    expect(estado.usos).toHaveLength(1);
  });

  it('registarConsumoPorSlot desconta correctamente por dicionário de slots', async () => {
    const b0 = criarBobina({
      nome: 'Bobina Slot 0',
      material: 'PLA',
      cor: '#ffffff',
      pesoInicial: 500,
      preco: 10,
      printerId: 'printer-2',
      canvasSlot: 0,
    });

    await guardarEstado({
      versao: 2,
      bobinas: [b0],
      garrafas: [],
      pendentes: [],
      perfis: [],
      usos: [],
    });

    await registarConsumoPorSlot('printer-2', { 0: 30 }, 'task-slot-test');

    const estado = await carregarEstado();
    expect(estado.bobinas[0].restante).toBe(470);
    expect(estado.usos[0].gramas).toBe(30);
  });

  it('cria pendente quando não há bobina correspondente', async () => {
    await guardarEstado({
      versao: 2,
      bobinas: [],
      garrafas: [],
      pendentes: [],
      perfis: [],
      usos: [],
    });

    await registarConsumo(
      'printer-1',
      '192.168.1.50',
      'peca_sem_bobina.gcode',
      42
    );

    const inv = await carregarInventario();
    expect(inv.pendentes).toHaveLength(1);
    expect(inv.pendentes[0].filename).toBe('peca_sem_bobina.gcode');
    expect(inv.pendentes[0].gramas).toBe(42);
  });

  it('confirmarConsumo aplica gramas, cria registo em usos e limpa pendente', async () => {
    const b0 = criarBobina({
      nome: 'Bobina Ativa',
      material: 'PLA',
      cor: '#ffffff',
      pesoInicial: 1000,
      preco: 20,
      printerId: 'printer-1',
    });

    await guardarEstado({
      versao: 2,
      bobinas: [b0],
      garrafas: [],
      pendentes: [
        {
          id: 'pendente-1',
          printerId: 'printer-1',
          filename: 'impressao.gcode',
          quando: Date.now(),
          gramas: null,
        },
      ],
      perfis: [],
      usos: [],
    });

    await confirmarConsumo('pendente-1', 75);

    const estado = await carregarEstado();
    expect(estado.pendentes).toHaveLength(0);
    expect(estado.bobinas[0].restante).toBe(925);
    expect(estado.usos).toHaveLength(1);
    expect(estado.usos[0]).toMatchObject({
      jobId: 'pendente-pendente-1',
      gramas: 75,
      custo: 1.5,
    });
  });

  describe('lerConsumoDoGcode e lerPesoDoGcode', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('extrai consumo por ferramenta do cabecalho Orca', async () => {
      const gcodeMock = `
; generated by OrcaSlicer
; filament_type = PLA;PETG
; filament_colour = #ffffff;#000000
; filament used [g] = 12.5, 30.0
G28
`;
      global.fetch = jest.fn(async () => ({
        ok: true,
        text: async () => gcodeMock,
      })) as any;

      const consumos = await lerConsumoDoGcode('192.168.1.50', 'multi.gcode');
      expect(consumos).toEqual([
        { slot: 0, gramas: 12.5 },
        { slot: 1, gramas: 30.0 },
      ]);

      const pesoTotal = await lerPesoDoGcode('192.168.1.50', 'multi.gcode');
      expect(pesoTotal).toBe(42.5);
    });

    it('faz fallback para total filament used [g]', async () => {
      const gcodeMock = `
; total filament used [g] = 45.6
G28
`;
      global.fetch = jest.fn(async () => ({
        ok: true,
        text: async () => gcodeMock,
      })) as any;

      const consumos = await lerConsumoDoGcode('192.168.1.50', 'single.gcode');
      expect(consumos).toEqual([{ gramas: 45.6 }]);
      const pesoTotal = await lerPesoDoGcode('192.168.1.50', 'single.gcode');
      expect(pesoTotal).toBe(45.6);
    });

    it('faz fallback para metros de Cura', async () => {
      const gcodeMock = `
;Filament used: 10m
G28
`;
      global.fetch = jest.fn(async () => ({
        ok: true,
        text: async () => gcodeMock,
      })) as any;

      // 10m * 2.98 = 29.8g
      const consumos = await lerConsumoDoGcode('192.168.1.50', 'cura.gcode');
      expect(consumos).toEqual([{ gramas: 29.8 }]);
    });

    it('devolve null em caso de erro HTTP ou sem peso', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
      })) as any;

      const consumos = await lerConsumoDoGcode(
        '192.168.1.50',
        'inexistente.gcode'
      );
      expect(consumos).toBeNull();
      const peso = await lerPesoDoGcode('192.168.1.50', 'inexistente.gcode');
      expect(peso).toBeNull();
    });
  });
});
