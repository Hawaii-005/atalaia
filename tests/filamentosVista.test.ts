import { CanvasTray } from '../src/utils/commands';
import {
  construirVistaSlots,
  corHex,
  nomeDaCor,
} from '../src/utils/filamentos/vista';
import { criarBobina } from '../src/utils/filamentos/operacoes';
import { Spool } from '../src/utils/filamentos/modelo';

const tray = (extra: Partial<CanvasTray> = {}): CanvasTray => ({
  tray_id: 0,
  brand: 'Elegoo',
  filament_type: 'PLA',
  filament_name: 'Rapid PLA+',
  filament_code: 'EAN',
  filament_color: '#077747',
  min_nozzle_temp: 190,
  max_nozzle_temp: 230,
  status: 1,
  ...extra,
});

const bobina = (extra: Partial<Parameters<typeof criarBobina>[0]> = {}) =>
  criarBobina({
    nome: 'PLA verde',
    marca: 'Elegoo',
    material: 'PLA',
    cor: '#077747',
    pesoInicial: 1000,
    preco: 20,
    printerId: 'p1',
    canvasSlot: 0,
    ...extra,
  });

const slot = (vistas: ReturnType<typeof construirVistaSlots>, n: number) =>
  vistas.find(v => v.trayId === n);

describe('corHex', () => {
  it('devolve o hex tal como vem, normalizado', () => {
    expect(corHex('#077747')).toBe('#077747');
    expect(corHex('077747')).toBe('#077747');
    expect(corHex('#AABBCC')).toBe('#aabbcc');
  });

  it('cai no recurso quando a cor não serve', () => {
    expect(corHex(null, '#123456')).toBe('#123456');
    expect(corHex('verde', '#123456')).toBe('#123456');
    expect(corHex('#abc', '#123456')).toBe('#123456');
  });
});

describe('nomeDaCor', () => {
  it('reconhece cores óbvias', () => {
    expect(nomeDaCor('#111111')).toBe('preto');
    expect(nomeDaCor('#077747')).toBe('verde');
    expect(nomeDaCor('#ffffff')).toBe('branco');
  });

  it('devolve vazio quando não é um hex de 6 dígitos', () => {
    expect(nomeDaCor('')).toBe('');
    expect(nomeDaCor(null)).toBe('');
    expect(nomeDaCor('#abc')).toBe('');
    expect(nomeDaCor('verde')).toBe('');
  });
});

describe('construirVistaSlots', () => {
  it('sem trays, devolve os quatro slots vazios', () => {
    const vistas = construirVistaSlots([], [], 'p1', 15);
    expect(vistas.map(v => v.rotulo)).toEqual(['A1', 'A2', 'A3', 'A4']);
    expect(vistas.every(v => v.estado === 'vazio')).toBe(true);
    expect(vistas.every(v => v.bobina === undefined)).toBe(true);
  });

  it('separa o que vem do Canvas do que é local', () => {
    const vistas = construirVistaSlots([tray()], [], 'p1', 15);
    const a1 = slot(vistas, 0)!;
    expect(a1.estado).toBe('semBobina');
    expect(a1.material).toBe('PLA');
    expect(a1.marca).toBe('Elegoo');
    expect(a1.nome).toBe('Rapid PLA+');
    expect(a1.cor).toBe('#077747');
    expect(a1.corNome).toBe('verde');
    expect(a1.minTemp).toBe(190);
    expect(a1.maxTemp).toBe(230);
    expect(a1.carregado).toBe(true);
    expect(a1.restanteG).toBeUndefined();
    expect(a1.percentagem).toBeUndefined();
  });

  it('mostra peso, percentagem e valor quando há bobina associada', () => {
    const spool = bobina({ restante: 250 });
    const vistas = construirVistaSlots([tray()], [spool], 'p1', 15);
    const a1 = slot(vistas, 0)!;
    expect(a1.estado).toBe('ok');
    expect(a1.bobina?.id).toBe(spool.id);
    expect(a1.restanteG).toBe(250);
    expect(a1.percentagem).toBe(25);
    expect(a1.valorRestante).toBe(5);
  });

  it('marca «quase no fim» pelo limite recebido', () => {
    const spool = bobina({ restante: 200 });
    expect(
      slot(construirVistaSlots([tray()], [spool], 'p1', 15), 0)?.estado
    ).toBe('ok');
    expect(
      slot(construirVistaSlots([tray()], [spool], 'p1', 20), 0)?.estado
    ).toBe('quaseNoFim');
  });

  it('ignora bobinas arquivadas e de outra impressora', () => {
    const arquivada = { ...bobina(), arquivada: true };
    const outra = bobina({ printerId: 'p2' });
    const vistas = construirVistaSlots([tray()], [arquivada, outra], 'p1', 15);
    expect(slot(vistas, 0)?.estado).toBe('semBobina');
  });

  it('assinala o tray activo sem confundir com o slot associado', () => {
    const vistas = construirVistaSlots(
      [tray({ tray_id: 0 }), tray({ tray_id: 1, filament_color: '#111111' })],
      [],
      'p1',
      15,
      1
    );
    expect(slot(vistas, 0)?.emUso).toBe(false);
    expect(slot(vistas, 1)?.emUso).toBe(true);
  });

  it('não inventa um slot para tray_id inválido', () => {
    const vistas = construirVistaSlots([tray({ tray_id: 255 })], [], 'p1', 15);
    expect(vistas).toHaveLength(4);
    expect(vistas.every(v => v.estado === 'vazio')).toBe(true);
  });

  it('aceita um tray sem cor e sem temperaturas', () => {
    const vistas = construirVistaSlots(
      [tray({ filament_color: '', min_nozzle_temp: 0, max_nozzle_temp: 0 })],
      [],
      'p1',
      15
    );
    const a1 = slot(vistas, 0)!;
    expect(a1.cor).toBeNull();
    expect(a1.corNome).toBe('');
    expect(a1.minTemp).toBeNull();
    expect(a1.maxTemp).toBeNull();
    expect(a1.estado).toBe('semBobina');
  });

  it('trata um slot sem dados nenhuns como vazio', () => {
    const vistas = construirVistaSlots(
      [
        tray({
          filament_type: '',
          brand: '',
          filament_color: '',
          filament_name: '',
          status: 0,
        }),
      ],
      [],
      'p1',
      15
    );
    expect(slot(vistas, 0)?.estado).toBe('vazio');
  });

  it('mantém a bobina certa quando há várias associadas', () => {
    const a = bobina({ nome: 'A', canvasSlot: 0 });
    const b: Spool = bobina({ nome: 'B', canvasSlot: 3, cor: '#111111' });
    const vistas = construirVistaSlots(
      [tray({ tray_id: 0 }), tray({ tray_id: 3 })],
      [a, b],
      'p1',
      15
    );
    expect(slot(vistas, 0)?.bobina?.nome).toBe('A');
    expect(slot(vistas, 3)?.bobina?.nome).toBe('B');
    expect(slot(vistas, 1)?.estado).toBe('vazio');
  });
});
