import {
  LIMITE_TICKS_PARADOS_MS,
  estadoDeInfo,
} from '../src/utils/controlos/estado';

describe('estadoDeInfo', () => {
  it('sem ligação manda sempre', () => {
    expect(estadoDeInfo(6, false, 0, 0)).toBe('sem-ligacao');
    expect(estadoDeInfo(0, false, null)).toBe('sem-ligacao');
  });

  it('sem estado ou com estado antigo não se confia no status', () => {
    expect(estadoDeInfo(6, true, null)).toBe('estado-antigo');
    expect(estadoDeInfo(6, true, 45_001)).toBe('estado-antigo');
  });

  it('mapeia os status conhecidos', () => {
    expect(estadoDeInfo(0, true, 0)).toBe('ociosa');
    expect(estadoDeInfo(1, true, 0)).toBe('a-preparar');
    expect(estadoDeInfo(6, true, 0, 0)).toBe('a-imprimir');
    expect(estadoDeInfo(8, true, 0)).toBe('ociosa');
    expect(estadoDeInfo(9, true, 0)).toBe('ociosa');
  });

  it('a pausa é ticks parados: o status continua 6', () => {
    expect(estadoDeInfo(6, true, 0, LIMITE_TICKS_PARADOS_MS)).toBe(
      'a-imprimir'
    );
    expect(estadoDeInfo(6, true, 0, LIMITE_TICKS_PARADOS_MS + 1)).toBe(
      'em-pausa'
    );
  });

  it('não confunde preparação com pausa', () => {
    expect(estadoDeInfo(16, true, 0, 999_999)).toBe('a-preparar');
  });

  it('status desconhecido vira erro, para bloquear o perigoso', () => {
    expect(estadoDeInfo(999, true, 0)).toBe('erro');
    expect(estadoDeInfo(null, true, 0)).toBe('ociosa');
  });
});
