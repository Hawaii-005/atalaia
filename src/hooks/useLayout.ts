import { useWindowDimensions } from 'react-native';

/**
 * Largura a partir da qual o ecrã é tratado como tablet. 720 dp cobre o
 * Galaxy Tab S10 Lite em retrato e qualquer tablet em paisagem; um telemóvel
 * (S25 Ultra tem ~412 dp) fica sempre abaixo.
 */
export const LIMIAR_TABLET = 720;

export interface Layout {
  largura: number;
  altura: number;
  isTablet: boolean;
  /** Colunas para cartões de slot: 1 no telemóvel, 2 em tablets largos. */
  colunasSlots: number;
}

export const colunasParaLargura = (largura: number): number =>
  largura >= 1100 ? 2 : 1;

export const useLayout = (): Layout => {
  const { width, height } = useWindowDimensions();
  return {
    largura: width,
    altura: height,
    isTablet: width >= LIMIAR_TABLET,
    colunasSlots: colunasParaLargura(width),
  };
};
