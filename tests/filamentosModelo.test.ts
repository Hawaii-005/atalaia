import {
  apagarBobina,
  associarSlot,
  bobinaDoSlot,
  bobinasActivas,
  criarBobina,
  custoDeConsumo,
  custoPorGrama,
  desassociarSlot,
  descontarConsumo,
  editarBobina,
  normalizarHex,
  percentagemRestante,
  quaseNoFim,
  slotValidoOuIndefinido,
} from '../src/utils/filamentos/operacoes';
import { Spool } from '../src/utils/filamentos/modelo';

const base = {
  nome: 'PLA preto',
  material: 'pla',
  cor: '#111111',
  pesoInicial: 1000,
  preco: 20,
  printerId: 'p1',
};

const bobina = (extra: Partial<Parameters<typeof criarBobina>[0]> = {}) =>
  criarBobina({ ...base, ...extra });

describe('normalizarHex', () => {
  it('aceita #rrggbb, rrggbb e #rgb', () => {
    expect(normalizarHex('#AABBCC')).toBe('#aabbcc');
    expect(normalizarHex('aabbcc')).toBe('#aabbcc');
    expect(normalizarHex('#abc')).toBe('#aabbcc');
  });

  it('recusa o que não é cor', () => {
    expect(normalizarHex('verde')).toBeUndefined();
    expect(normalizarHex('#12345')).toBeUndefined();
    expect(normalizarHex(undefined)).toBeUndefined();
  });
});

describe('criarBobina', () => {
  it('põe valores por omissão coerentes', () => {
    const spool = bobina();
    expect(spool.restante).toBe(1000);
    expect(spool.material).toBe('PLA');
    expect(spool.cor).toBe('#111111');
    expect(spool.marca).toBe('');
    expect(spool.canvasSlot).toBeUndefined();
    expect(spool.arquivada).toBeUndefined();
  });

  it('exige nome e impressora', () => {
    expect(() => bobina({ nome: '   ' })).toThrow(/nome/);
    expect(() => bobina({ printerId: '' })).toThrow(/impressora/);
  });

  it('recusa peso e preço negativos', () => {
    expect(() => bobina({ pesoInicial: -1 })).toThrow(/negativo/);
    expect(() => bobina({ preco: -0.01 })).toThrow(/negativo/);
  });

  it('limita o restante ao peso inicial', () => {
    expect(bobina({ pesoInicial: 500, restante: 900 }).restante).toBe(500);
    expect(bobina({ pesoInicial: 500, restante: -3 }).restante).toBe(0);
  });

  it('descarta um slot fora de 0..3', () => {
    expect(bobina({ canvasSlot: 2 }).canvasSlot).toBe(2);
    expect(bobina({ canvasSlot: 7 }).canvasSlot).toBeUndefined();
    expect(bobina({ canvasSlot: null }).canvasSlot).toBeUndefined();
  });
});

describe('editarBobina', () => {
  it('não deixa o restante ficar acima do peso novo', () => {
    const spool = bobina({ pesoInicial: 1000, restante: 900 });
    expect(editarBobina(spool, { pesoInicial: 400 }).restante).toBe(400);
  });

  it('mantém o id e a data de criação', () => {
    const spool = bobina();
    const novo = editarBobina(spool, {
      nome: 'PETG branco',
      material: 'petg',
    });
    expect(novo.id).toBe(spool.id);
    expect(novo.criadoEm).toBe(spool.criadoEm);
    expect(novo.nome).toBe('PETG branco');
  });

  it('ignora uma cor inválida em vez de a guardar', () => {
    const spool = bobina();
    expect(editarBobina(spool, { cor: 'roxo' }).cor).toBe(spool.cor);
  });

  it('permite largar o slot', () => {
    const spool = bobina({ canvasSlot: 1 });
    expect(editarBobina(spool, { canvasSlot: undefined }).canvasSlot).toBe(
      spool.canvasSlot
    );
    expect(
      editarBobina(spool, { canvasSlot: null }).canvasSlot
    ).toBeUndefined();
  });
});

describe('descontarConsumo', () => {
  it('desconta e arredonda a 1 decimal', () => {
    const spool = bobina();
    expect(descontarConsumo(spool, 12.34).restante).toBe(987.7);
  });

  it('nunca fica negativo quando o consumo passa do restante', () => {
    const spool = { ...bobina(), restante: 10 };
    expect(descontarConsumo(spool, 500).restante).toBe(0);
  });

  it('ignora consumos inválidos ou negativos', () => {
    const spool = bobina();
    expect(descontarConsumo(spool, -50).restante).toBe(1000);
    expect(descontarConsumo(spool, Number.NaN).restante).toBe(1000);
  });
});

describe('custo', () => {
  it('calcula o custo por grama', () => {
    expect(custoPorGrama(bobina())).toBeCloseTo(0.02, 5);
  });

  it('devolve 0 sem preço', () => {
    const semPreco = bobina({ preco: 0 });
    expect(custoPorGrama(semPreco)).toBe(0);
    expect(custoDeConsumo(semPreco, 100)).toBe(0);
  });

  it('devolve 0 quando o peso inicial é 0', () => {
    const vazia = bobina({ pesoInicial: 0, preco: 20 });
    expect(custoPorGrama(vazia)).toBe(0);
  });

  it('calcula o custo do consumo em euros', () => {
    expect(custoDeConsumo(bobina(), 250)).toBe(5);
  });
});

describe('percentagemRestante', () => {
  it('é 0 quando o peso inicial é 0', () => {
    expect(percentagemRestante(bobina({ pesoInicial: 0 }))).toBe(0);
  });

  it('nunca passa de 100 nem desce de 0', () => {
    const spool = { ...bobina(), restante: 2000 };
    expect(percentagemRestante(spool)).toBe(100);
    expect(percentagemRestante({ ...spool, restante: 0 })).toBe(0);
  });

  it('marca quase no fim pelo limite pedido', () => {
    const spool = { ...bobina(), restante: 100 };
    expect(quaseNoFim(spool)).toBe(true);
    expect(quaseNoFim({ ...spool, restante: 200 })).toBe(false);
    expect(quaseNoFim({ ...spool, restante: 200 }, 25)).toBe(true);
  });
});

describe('slots', () => {
  const a = bobina({ nome: 'A', canvasSlot: 0 });
  const b = bobina({ nome: 'B' });

  it('associa e encontra a bobina do slot', () => {
    const lista = associarSlot([a, b], b.id, 'p1', 2);
    expect(bobinaDoSlot(lista, 'p1', 2)?.id).toBe(b.id);
  });

  it('um slot só tem uma bobina', () => {
    const lista = associarSlot([a, b], b.id, 'p1', 0);
    expect(bobinaDoSlot(lista, 'p1', 0)?.id).toBe(b.id);
    expect(lista.find(item => item.id === a.id)?.canvasSlot).toBeUndefined();
  });

  it('recusa slot inválido e impressora diferente', () => {
    expect(() => associarSlot([a, b], b.id, 'p1', 9)).toThrow(/Slot/);
    expect(() => associarSlot([a, b], b.id, 'p2', 1)).toThrow(/impressora/);
  });

  it('desassocia sem tocar nas outras', () => {
    const lista = desassociarSlot([a, b], a.id);
    expect(lista[0].canvasSlot).toBeUndefined();
    expect(bobinaDoSlot(lista, 'p1', 0)).toBeUndefined();
  });

  it('valida slots fora do intervalo', () => {
    expect(slotValidoOuIndefinido(3)).toBe(3);
    expect(slotValidoOuIndefinido('1')).toBe(1);
    expect(slotValidoOuIndefinido(4)).toBeUndefined();
    expect(slotValidoOuIndefinido(-1)).toBeUndefined();
    expect(slotValidoOuIndefinido(1.5)).toBeUndefined();
  });
});

describe('listas', () => {
  const a: Spool = bobina({ nome: 'A' });
  const b: Spool = bobina({ nome: 'B' });

  it('apaga só a bobina pedida', () => {
    expect(apagarBobina([a, b], a.id).map(item => item.nome)).toEqual(['B']);
  });

  it('deixa as arquivadas fora do inventário activo', () => {
    const arquivada = { ...b, arquivada: true };
    expect(bobinasActivas([a, arquivada]).map(item => item.nome)).toEqual([
      'A',
    ]);
  });
});
