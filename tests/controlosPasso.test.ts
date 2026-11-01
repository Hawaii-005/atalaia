import {
  PASSOS,
  PASSO_PREDEFINIDO,
  ehPasso,
  lerPassos,
  passoDe,
  zPrecisaConfirmacao,
} from '../src/utils/controlos/passo';

describe('passo do movimento', () => {
  it('só aceita os quatro passos do protocolo', () => {
    expect(PASSOS.every(ehPasso)).toBe(true);
    expect(ehPasso(0.05)).toBe(false);
    expect(ehPasso('10')).toBe(false);
  });

  it('lê o mapa guardado e descarta lixo', () => {
    expect(lerPassos({ a: 0.1, b: 7, c: '1' })).toEqual({ a: 0.1 });
    expect(lerPassos(null)).toEqual({});
    expect(lerPassos([1])).toEqual({});
  });

  it('cai no passo predefinido quando a impressora não tem valor', () => {
    expect(passoDe({}, 'x')).toBe(PASSO_PREDEFINIDO);
    expect(passoDe({ x: 0.1 }, 'x')).toBe(0.1);
  });

  it('só pede confirmação a descer com 10 ou 50 mm', () => {
    expect(zPrecisaConfirmacao(10, -1)).toBe(true);
    expect(zPrecisaConfirmacao(50, -1)).toBe(true);
    expect(zPrecisaConfirmacao(1, -1)).toBe(false);
    expect(zPrecisaConfirmacao(0.1, -1)).toBe(false);
    expect(zPrecisaConfirmacao(50, 1)).toBe(false);
  });
});
