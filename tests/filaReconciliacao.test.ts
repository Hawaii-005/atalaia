import { criarItem, ItemFila } from '../src/utils/fila/modelo';
import {
  ESTADO_TERMINADA,
  EstadoReal,
  estadoDoCurso,
  lerCurso,
  lerCursos,
  mesmoTrabalho,
  reconciliarFila,
  reconciliarItem,
} from '../src/utils/fila/reconciliacao';

const AGORA = 1_700_000_000_000;

const bloqueado = (name = 'peca_45m.gcode'): ItemFila => ({
  ...criarItem({
    id: 'a',
    printerId: 'p1',
    name,
    label: name,
    agora: AGORA,
    opcoes: { nivelar: false, lado: 0 },
  }),
  estado: 'bloqueado',
  motivo: 'envioInterrompido',
  arranqueTentado: true,
});

const curso = {
  printerId: 'p1',
  itemId: 'a',
  name: 'peca_45m.gcode',
  startedAt: AGORA,
};

describe('nomes de ficheiros', () => {
  it('compara só o nome, sem caminho nem maiúsculas', () => {
    expect(mesmoTrabalho('/local/Peca_45M.gcode', 'peca_45m.gcode')).toBe(true);
    expect(mesmoTrabalho('outra.gcode', 'peca_45m.gcode')).toBe(false);
    expect(mesmoTrabalho(undefined, 'peca_45m.gcode')).toBe(false);
  });
});

describe('leitura do curso guardado', () => {
  it('descarta registos incompletos', () => {
    expect(lerCurso({ printerId: 'p1' })).toBeNull();
    expect(lerCurso(null)).toBeNull();
    expect(lerCurso(curso)).toMatchObject({ printerId: 'p1', itemId: 'a' });
  });

  it('indexa pelo id da impressora', () => {
    expect(Object.keys(lerCursos({ p1: curso }))).toEqual(['p1']);
    expect(lerCursos('lixo')).toEqual({});
  });
});

describe('estado do curso', () => {
  it('sem ligação não decide nada', () => {
    expect(estadoDoCurso(curso, { ligada: false })).toBe('desconhecido');
  });

  it('reconhece o nosso ficheiro a imprimir', () => {
    expect(
      estadoDoCurso(curso, {
        ligada: true,
        aImprimir: '/local/peca_45m.gcode',
        estado: 5,
      })
    ).toBe('aCorrer');
  });

  it('terminada conta como terminado', () => {
    expect(
      estadoDoCurso(curso, { ligada: true, estado: ESTADO_TERMINADA })
    ).toBe('terminou');
  });

  it('outro ficheiro a imprimir conta como terminado', () => {
    expect(
      estadoDoCurso(curso, {
        ligada: true,
        aImprimir: 'outra.gcode',
        estado: 5,
      })
    ).toBe('terminou');
  });

  it('ligada mas sem estado é desconhecido', () => {
    expect(estadoDoCurso(curso, { ligada: true })).toBe('desconhecido');
  });
});

describe('reconciliar um item bloqueado', () => {
  it('a máquina está a imprimir o nosso ficheiro: passa a «a imprimir»', () => {
    const item = reconciliarItem(
      bloqueado(),
      { ligada: true, aImprimir: 'peca_45m.gcode', estado: 5 },
      AGORA + 1
    );
    expect(item.estado).toBe('aImprimir');
    expect(item.motivo).toBeUndefined();
  });

  it('a máquina está livre e não é nosso: volta a pendente', () => {
    const item = reconciliarItem(
      bloqueado(),
      { ligada: true, estado: ESTADO_TERMINADA },
      AGORA + 1
    );
    expect(item.estado).toBe('pendente');
    expect(item.motivo).toBeUndefined();
  });

  it('sem ligação fica bloqueado', () => {
    const original = bloqueado();
    expect(reconciliarItem(original, { ligada: false }, AGORA + 1)).toBe(
      original
    );
  });

  it('a imprimir outro ficheiro não desbloqueia', () => {
    const original = bloqueado();
    expect(
      reconciliarItem(
        original,
        { ligada: true, aImprimir: 'outra.gcode', estado: 5 },
        AGORA + 1
      )
    ).toBe(original);
  });

  it('só mexe em bloqueios por envio interrompido', () => {
    const outro: ItemFila = { ...bloqueado(), motivo: 'semLigacao' };
    expect(reconciliarItem(outro, { ligada: true, estado: 9 }, AGORA + 1)).toBe(
      outro
    );
  });

  it('reconciliar a lista preserva os itens que não interessam', () => {
    const pendente = criarItem({
      id: 'b',
      printerId: 'p1',
      name: 'b.gcode',
      label: 'b.gcode',
      agora: AGORA,
      opcoes: { nivelar: false, lado: 0 },
    });
    const lista = reconciliarFila(
      [pendente, bloqueado()],
      { ligada: true, estado: 9 },
      AGORA + 1
    );
    expect(lista[0]).toBe(pendente);
    expect(lista[1].estado).toBe('pendente');
  });
});

describe('tipo de estado real', () => {
  it('aceita uma impressora ligada e ociosa', () => {
    const real: EstadoReal = { ligada: true, estado: 9 };
    expect(real.ligada).toBe(true);
  });
});
