import { colunasFicheiros } from '../src/theme/layout';
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

describe('colunasFicheiros', () => {
  it('no telemóvel mantém 3/2/1', () => {
    expect(colunasFicheiros('compacta', 'p')).toBe(3);
    expect(colunasFicheiros('compacta', 'm')).toBe(2);
    expect(colunasFicheiros('compacta', 'g')).toBe(1);
  });

  it('no tablet em paisagem usa 8/6/4', () => {
    expect(colunasFicheiros('expandida', 'p')).toBe(8);
    expect(colunasFicheiros('expandida', 'm')).toBe(6);
    expect(colunasFicheiros('expandida', 'g')).toBe(4);
  });

  it('nas larguras intermédias fica entre os dois', () => {
    expect(colunasFicheiros('media', 'p')).toBe(5);
    expect(colunasFicheiros('media', 'm')).toBe(4);
    expect(colunasFicheiros('media', 'g')).toBe(3);
  });

  it('cabe sempre no ecrã: as colunas nunca passam de 8', () => {
    (['compacta', 'media', 'expandida'] as const).forEach(classe => {
      (['p', 'm', 'g'] as const).forEach(tamanho => {
        expect(colunasFicheiros(classe, tamanho)).toBeLessThanOrEqual(8);
      });
    });
  });
});
