import { useWindowDimensions } from 'react-native';

/**
 * Classes de largura de janela (Material 3). A decisão é sempre pela janela —
 * nunca pelo modelo do aparelho — para funcionar em rotação, ecrã dividido e DeX.
 *
 *   compacta  < 600 dp   telemóveis (S25 Ultra, Note 20 Ultra em retrato)
 *   média     600–840    tablet em retrato, telemóvel em paisagem, ecrã dividido
 *   expandida ≥ 840      tablet em paisagem
 */

export type ClasseJanela = 'compacta' | 'media' | 'expandida';

export const limites = { media: 600, expandida: 840 } as const;

/** Acima disto o conteúdo deixa de crescer e centra-se. */
export const larguraMaximaConteudo = 840;

export const classeDaLargura = (l: number): ClasseJanela =>
  l < limites.media ? 'compacta' : l < limites.expandida ? 'media' : 'expandida';

/** Margem lateral por classe (16 nos telemóveis, 24 nos tablets). */
export const margemDe = (classe: ClasseJanela): number => (classe === 'compacta' ? 16 : 24);

/** Quantas colunas usar numa grelha de cartões. */
export const colunasDe = (classe: ClasseJanela): number =>
  classe === 'expandida' ? 3 : classe === 'media' ? 2 : 1;

/** Largura do rail de navegação (tablet). */
export const larguraRail = 88;

export function useJanela() {
  const { width, height } = useWindowDimensions();
  const classe = classeDaLargura(width);
  return {
    width,
    height,
    classe,
    paisagem: width > height,
    compacta: classe === 'compacta',
    media: classe === 'media',
    expandida: classe === 'expandida',
    margem: margemDe(classe),
    colunas: colunasDe(classe),
    /** largura útil para conteúdo, já limitada e centrável */
    larguraConteudo: Math.min(width, larguraMaximaConteudo),
  };
}
