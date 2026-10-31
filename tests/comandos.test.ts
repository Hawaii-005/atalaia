import { normalizarCor, consumoDoGcode } from '../src/utils/gcodeCores';

describe('cores do cabeçalho', () => {
  it('#rgb passa a #rrggbb', () => {
    expect(normalizarCor('#0af')).toBe('#00aaff');
  });
  it('lixo devolve undefined', () => {
    expect(normalizarCor('verde')).toBeUndefined();
  });
});

describe('consumo de filamento', () => {
  it('soma o E em modo absoluto, sem contar viagens', () => {
    const gcode = [
      'G1 X0 Y0 E0',
      'G1 X10 E5',
      'G1 X20 E5', // sem extrusão nova
      'G1 X30 E15',
    ].join('\n');
    const { metros, gramas } = consumoDoGcode(gcode, 1.75);
    expect(metros).toBeCloseTo(0.015, 4); // 15 mm
    expect(gramas).toBeGreaterThan(0);
  });

  it('modo relativo (M83) soma os incrementos', () => {
    const gcode = ['M83', 'G1 X10 E2', 'G1 X20 E3'].join('\n');
    expect(consumoDoGcode(gcode, 1.75).metros).toBeCloseTo(0.005, 4); // 5 mm
  });

  it('material do cabeçalho muda a densidade', () => {
    const pla = '; filament_type = PLA\nG1 E10';
    const abs = '; filament_type = ABS\nG1 E10';
    expect(consumoDoGcode(pla).gramas).toBeGreaterThan(
      consumoDoGcode(abs).gramas
    );
  });
});
