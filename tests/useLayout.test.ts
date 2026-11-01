import { LIMIAR_TABLET, colunasParaLargura } from '../src/hooks/useLayout';

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1000, height: 800 }),
}));

describe('useLayout', () => {
  it('define o limiar de tablet em 720 dp', () => {
    expect(LIMIAR_TABLET).toBe(720);
  });

  it('calcula colunas para ecrãs normais vs largos', () => {
    expect(colunasParaLargura(412)).toBe(1);
    expect(colunasParaLargura(720)).toBe(1);
    expect(colunasParaLargura(1099)).toBe(1);
    expect(colunasParaLargura(1100)).toBe(2);
    expect(colunasParaLargura(1600)).toBe(2);
  });
});
