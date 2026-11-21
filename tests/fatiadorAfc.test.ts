import { riscoAfc, LIMITE_PLA, Pista } from '../src/utils/fatiador/afc';

const pista = (material: string, max: number | null = null): Pista => ({
  material,
  max,
  carregada: true,
});

describe('cruzamento AFC × PRINT_START', () => {
  it('PLA na pista com bico a 260 °C é risco', () => {
    expect(riscoAfc(pista('PLA'), 260)).toBe('PLA');
  });

  it('o mesmo PLA no bico a 210 °C não é risco', () => {
    expect(riscoAfc(pista('PLA'), 210)).toBeNull();
  });

  it('exatamente no limite não avisa (só acima de 235)', () => {
    expect(riscoAfc(pista('PLA'), LIMITE_PLA)).toBeNull();
    expect(riscoAfc(pista('PLA'), LIMITE_PLA + 1)).toBe('PLA');
  });

  it('ABS na pista a 260 °C é legítimo', () => {
    expect(riscoAfc(pista('ABS'), 260)).toBeNull();
  });

  it('AFC sem resposta não inventa risco nem aprovação', () => {
    expect(riscoAfc(null, 260)).toBeNull();
  });

  it('material vazio na pista não é PLA', () => {
    expect(riscoAfc(pista(''), 260)).toBeNull();
  });
});
