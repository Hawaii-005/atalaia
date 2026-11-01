import { criarItem } from '../src/utils/fila/modelo';
import { estimarFila, formatarHora } from '../src/utils/fila/estimativas';

const AGORA = new Date('2026-11-01T10:00:00.000Z').getTime();

const item = (id: string, duracaoSeg?: number) =>
  criarItem({
    id,
    printerId: 'p1',
    name: `${id}.gcode`,
    label: `${id}.gcode`,
    agora: AGORA,
    opcoes: { nivelar: false, lado: 0 },
    ...(duracaoSeg !== undefined ? { duracaoSeg } : {}),
  });

describe('estimarFila', () => {
  it('encadeia as horas quando todas as durações são conhecidas', () => {
    const estimativa = estimarFila(
      [item('a', 600), item('b', 1800), item('c', 300)],
      AGORA
    );
    expect(estimativa.completa).toBe(true);
    expect(estimativa.totalSeg).toBe(2700);
    expect(estimativa.itens.a).toEqual({
      duracaoSeg: 600,
      inicio: AGORA,
      fim: AGORA + 600_000,
    });
    expect(estimativa.itens.b.inicio).toBe(AGORA + 600_000);
    expect(estimativa.itens.c.fim).toBe(AGORA + 2_700_000);
  });

  it('não inventa horas depois de um item sem duração', () => {
    const estimativa = estimarFila(
      [item('a', 600), item('b'), item('c', 300)],
      AGORA
    );
    expect(estimativa.completa).toBe(false);
    expect(estimativa.totalSeg).toBe(900);
    expect(estimativa.itens.a.fim).toBe(AGORA + 600_000);
    expect(estimativa.itens.b).toEqual({});
    expect(estimativa.itens.c).toEqual({ duracaoSeg: 300 });
  });

  it('uma duração inválida conta como desconhecida', () => {
    const estimativa = estimarFila([item('a', 0), item('b', -5)], AGORA);
    expect(estimativa.completa).toBe(false);
    expect(estimativa.totalSeg).toBe(0);
  });

  it('fila vazia não é considerada completa', () => {
    const estimativa = estimarFila([], AGORA);
    expect(estimativa).toEqual({
      itens: {},
      totalSeg: 0,
      completa: false,
      contagem: 0,
    });
  });
});

describe('formatarHora', () => {
  it('devolve vazio quando não há hora', () => {
    expect(formatarHora(undefined, 'pt-PT')).toBeUndefined();
    expect(formatarHora(Number.NaN, 'pt-PT')).toBeUndefined();
  });

  it('devolve uma hora com dois dígitos', () => {
    expect(formatarHora(AGORA, 'pt-PT')).toMatch(/^\d{2}:\d{2}$/);
  });
});
