/**
 * Passo do movimento — valores permitidos e regras de confirmação.
 *
 * O passo é guardado por impressora para sobreviver a rodar o ecrã e a fechar
 * a app. Não inventa limites de curso: a máquina é que os aplica.
 */

export const PASSOS = [0.1, 1, 10, 50] as const;

export type PassoMm = (typeof PASSOS)[number];

export const PASSO_PREDEFINIDO: PassoMm = 10;

export const CHAVE_PASSO = 'atalaia.controlos.passo.v1';

export const ehPasso = (valor: unknown): valor is PassoMm =>
  typeof valor === 'number' && (PASSOS as readonly number[]).includes(valor);

export const lerPassos = (cru: unknown): Record<string, PassoMm> => {
  if (!cru || typeof cru !== 'object' || Array.isArray(cru)) return {};
  const mapa: Record<string, PassoMm> = {};
  Object.entries(cru as Record<string, unknown>).forEach(([id, valor]) => {
    if (id && ehPasso(valor)) mapa[id] = valor;
  });
  return mapa;
};

export const passoDe = (
  passos: Record<string, PassoMm>,
  printerId: string
): PassoMm => passos[printerId] ?? PASSO_PREDEFINIDO;

/**
 * Z para baixo com passo grande: pede confirmação. Com 0.1 e 1 mm não pede,
 * para não tornar o ajuste fino penoso.
 */
export const zPrecisaConfirmacao = (passo: PassoMm, sentido: 1 | -1): boolean =>
  sentido === -1 && (passo === 10 || passo === 50);

/** Texto de um passo: «0.1 mm», «1 mm». */
export const rotuloPasso = (passo: PassoMm): string => `${passo} mm`;
