import {
  CONTAGENS,
  MODO_PREDEFINIDO,
  lerModoConfig,
  lerModos,
  migrarFilaAuto,
  modoDe,
  pedeConfirmacao,
  segundosRestantes,
} from '../src/utils/fila/modos';

describe('modos de arranque', () => {
  it('o modo por omissão é manual e não arranca sozinho', () => {
    expect(MODO_PREDEFINIDO.modo).toBe('manual');
    expect(pedeConfirmacao(MODO_PREDEFINIDO)).toBe(false);
  });

  it('«com confirmação» pede a mesa limpa', () => {
    expect(pedeConfirmacao({ modo: 'confirmar', contagemSeg: 30 })).toBe(true);
  });

  it('lê uma configuração guardada e corrige o que está mal', () => {
    expect(lerModoConfig({ modo: 'confirmar', contagemSeg: 15 })).toEqual({
      modo: 'confirmar',
      contagemSeg: 15,
    });
    expect(lerModoConfig({ modo: 'inventado', contagemSeg: 7 })).toEqual(
      MODO_PREDEFINIDO
    );
    expect(lerModoConfig(null)).toEqual(MODO_PREDEFINIDO);
  });

  it('só aceita as contagens previstas', () => {
    for (const segundos of CONTAGENS) {
      expect(
        lerModoConfig({ modo: 'confirmar', contagemSeg: segundos }).contagemSeg
      ).toBe(segundos);
    }
    expect(
      lerModoConfig({ modo: 'confirmar', contagemSeg: 45 }).contagemSeg
    ).toBe(60);
  });

  it('migra o filaAuto antigo: «1» era perguntar antes de arrancar', () => {
    expect(migrarFilaAuto('1')).toEqual({ modo: 'confirmar', contagemSeg: 60 });
    expect(migrarFilaAuto('0')).toEqual({ modo: 'manual', contagemSeg: 60 });
    expect(migrarFilaAuto(null)).toEqual(MODO_PREDEFINIDO);
  });

  it('lê o mapa por impressora e ignora lixo', () => {
    expect(lerModos({ p1: { modo: 'confirmar', contagemSeg: 30 } })).toEqual({
      p1: { modo: 'confirmar', contagemSeg: 30 },
    });
    expect(lerModos([])).toEqual({});
    expect(lerModos('x')).toEqual({});
  });

  it('cada impressora tem o seu modo; o «*» serve de omissão', () => {
    const modos = {
      '*': { modo: 'confirmar', contagemSeg: 60 },
      p1: { modo: 'manual', contagemSeg: 60 },
    } as const;
    expect(modoDe(modos, 'p1').modo).toBe('manual');
    expect(modoDe(modos, 'p2').modo).toBe('confirmar');
    expect(modoDe({}, 'p3')).toEqual(MODO_PREDEFINIDO);
  });

  it('a contagem nunca fica negativa', () => {
    expect(segundosRestantes(1000, 0)).toBe(1);
    expect(segundosRestantes(900, 1000)).toBe(0);
    expect(segundosRestantes(2500, 1000)).toBe(2);
  });
});
