import {
  limitarProgresso,
  alturaRevelada,
  topoFrente,
  estadoDaPrevia,
  EstadoPrevia,
} from '../src/utils/revelacao';

describe('limitarProgresso', () => {
  it('limites: 0 mantém 0', () => {
    expect(limitarProgresso(0)).toBe(0);
  });

  it('limites: 100 mantém 100', () => {
    expect(limitarProgresso(100)).toBe(100);
  });

  it('negativos ficam em 0', () => {
    expect(limitarProgresso(-5)).toBe(0);
    expect(limitarProgresso(-0.1)).toBe(0);
  });

  it('valores acima de 100 ficam em 100', () => {
    expect(limitarProgresso(150)).toBe(100);
    expect(limitarProgresso(100.1)).toBe(100);
  });

  it('NaN resulta em 0', () => {
    expect(limitarProgresso(NaN)).toBe(0);
  });

  it('undefined e null resultam em 0', () => {
    expect(limitarProgresso(undefined)).toBe(0);
    expect(limitarProgresso(null)).toBe(0);
  });

  it('strings não numéricas resultam em 0', () => {
    expect(limitarProgresso('abc')).toBe(0);
    expect(limitarProgresso('')).toBe(0);
  });

  it('arredonda a uma casa decimal', () => {
    expect(limitarProgresso(33.333)).toBe(33.3);
    expect(limitarProgresso(66.666)).toBe(66.7);
    expect(limitarProgresso(12.345)).toBe(12.3);
    expect(limitarProgresso(99.99)).toBe(100);
  });

  it('strings numéricas são convertidas e limitadas', () => {
    expect(limitarProgresso('50')).toBe(50);
    expect(limitarProgresso('33.3')).toBe(33.3);
    expect(limitarProgresso('150')).toBe(100);
  });
});

describe('alturaRevelada', () => {
  it('progresso 0 → altura revelada 0', () => {
    expect(alturaRevelada(0, 260)).toBe(0);
    expect(alturaRevelada(0, 100)).toBe(0);
  });

  it('progresso 100 → altura revelada igual à altura total', () => {
    expect(alturaRevelada(100, 260)).toBe(260);
    expect(alturaRevelada(100, 100)).toBe(100);
  });

  it('progresso 50 com altura 260 → 130', () => {
    expect(alturaRevelada(50, 260)).toBe(130);
  });

  it('valores fracionários de progresso', () => {
    expect(alturaRevelada(33.3, 300)).toBeCloseTo(99.9, 1);
    expect(alturaRevelada(66.7, 150)).toBeCloseTo(100.05, 1);
    expect(alturaRevelada(12.5, 80)).toBe(10);
  });

  it('progresso negativo é tratado como 0', () => {
    expect(alturaRevelada(-10, 200)).toBe(0);
  });

  it('progresso acima de 100 é limitado a 100', () => {
    expect(alturaRevelada(150, 200)).toBe(200);
  });
});

describe('topoFrente', () => {
  it('progresso 0 → topo igual à altura total', () => {
    expect(topoFrente(0, 260)).toBe(260);
    expect(topoFrente(0, 100)).toBe(100);
  });

  it('progresso 100 → topo 0', () => {
    expect(topoFrente(100, 260)).toBe(0);
    expect(topoFrente(100, 100)).toBe(0);
  });

  it('progresso 50 com altura 260 → 130', () => {
    expect(topoFrente(50, 260)).toBe(130);
  });

  it('valores fracionários de progresso', () => {
    expect(topoFrente(33.3, 300)).toBeCloseTo(200.1, 1);
    expect(topoFrente(66.7, 150)).toBeCloseTo(49.95, 1);
    expect(topoFrente(12.5, 80)).toBe(70);
  });
});

describe('estadoDaPrevia', () => {
  it('impressora desligada → sem-ligacao (prioritário sobre status)', () => {
    expect(estadoDaPrevia(6, false)).toBe('sem-ligacao');
    expect(estadoDaPrevia(20, false)).toBe('sem-ligacao');
    expect(estadoDaPrevia(9, false)).toBe('sem-ligacao');
    expect(estadoDaPrevia(null, false)).toBe('sem-ligacao');
    expect(estadoDaPrevia(undefined, false)).toBe('sem-ligacao');
  });

  it('status 6 → a-imprimir', () => {
    expect(estadoDaPrevia(6, true)).toBe('a-imprimir');
  });

  it('status 20 → em-pausa', () => {
    expect(estadoDaPrevia(20, true)).toBe('em-pausa');
  });

  it('status 9 → concluida', () => {
    expect(estadoDaPrevia(9, true)).toBe('concluida');
  });

  it('status 8 → parada', () => {
    expect(estadoDaPrevia(8, true)).toBe('parada');
  });

  it('status desconhecido → repouso', () => {
    expect(estadoDaPrevia(0, true)).toBe('repouso');
    expect(estadoDaPrevia(1, true)).toBe('repouso');
    expect(estadoDaPrevia(7, true)).toBe('repouso');
    expect(estadoDaPrevia(10, true)).toBe('repouso');
    expect(estadoDaPrevia(99, true)).toBe('repouso');
  });

  it('status null/undefined → repouso', () => {
    expect(estadoDaPrevia(null, true)).toBe('repouso');
    expect(estadoDaPrevia(undefined, true)).toBe('repouso');
  });
});

describe('invariante: alturaRevelada + topoFrente === altura', () => {
  const alturas = [100, 260, 300, 150, 80];
  const progressos = [0, 10, 25, 33.3, 50, 66.7, 75, 90, 100];

  it.each(alturas)('para altura %d, a soma é invariante', (altura) => {
    progressos.forEach((p) => {
      const revelada = alturaRevelada(p, altura);
      const topo = topoFrente(p, altura);
      expect(revelada + topo).toBeCloseTo(altura, 1);
    });
  });

  it('também funciona com progressos fora de limites (são limitados internamente)', () => {
    const altura = 200;
    expect(alturaRevelada(-10, altura) + topoFrente(-10, altura)).toBeCloseTo(altura, 1);
    expect(alturaRevelada(150, altura) + topoFrente(150, altura)).toBeCloseTo(altura, 1);
  });
});