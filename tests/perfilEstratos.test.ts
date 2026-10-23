import { meiaLargura, camadasPostas, CAMADAS_DESENHADAS } from '../src/utils/perfilEstratos';

describe('camadasPostas', () => {
  it('total válido usa actual/total', () => {
    expect(camadasPostas(50, 100, 0, 72)).toBe(36);
  });
  
  it('total 0 usa progresso/100', () => {
    expect(camadasPostas(0, 0, 50, 72)).toBe(36);
  });

  it('progresso 100 resulta em n', () => {
    expect(camadasPostas(0, 0, 100, 72)).toBe(72);
  });

  it('valores negativos resultam em 0', () => {
    expect(camadasPostas(-10, 100, 0, 72)).toBe(0);
    expect(camadasPostas(0, 0, -50, 72)).toBe(0);
  });

  it('NaN resulta em 0', () => {
    expect(camadasPostas(NaN, 100, 0, 72)).toBe(0);
    expect(camadasPostas(0, 0, NaN, 72)).toBe(0);
  });

  it('usa CAMADAS_DESENHADAS quando n é omitido', () => {
    expect(camadasPostas(36, 72, 0)).toBe(36);
  });
});

describe('meiaLargura', () => {
  it('sempre entre 26 e 150 para tipo fdm e i=0, i=n-1', () => {
    const min = meiaLargura(0, 72, 'fdm');
    const topo = meiaLargura(71, 72, 'fdm');
    expect(min).toBeGreaterThanOrEqual(26);
    expect(min).toBeLessThanOrEqual(150);
    expect(topo).toBeGreaterThanOrEqual(26);
    expect(topo).toBeLessThanOrEqual(150);
  });

  it('sempre entre 26 e 150 para tipo resina e i=0, i=n-1', () => {
    const min = meiaLargura(0, 72, 'resina');
    const topo = meiaLargura(71, 72, 'resina');
    expect(min).toBeGreaterThanOrEqual(26);
    expect(min).toBeLessThanOrEqual(150);
    expect(topo).toBeGreaterThanOrEqual(26);
    expect(topo).toBeLessThanOrEqual(150);
  });

  it('é determinística', () => {
    expect(meiaLargura(15, 72, 'fdm')).toBe(meiaLargura(15, 72, 'fdm'));
    expect(meiaLargura(40, 72, 'resina')).toBe(meiaLargura(40, 72, 'resina'));
  });
});
