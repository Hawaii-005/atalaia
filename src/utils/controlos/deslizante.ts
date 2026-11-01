/**
 * Conversão de um toque num valor percentual — pura, para poder ser testada
 * sem ecrã. O slider envia o valor ao soltar; isto só calcula o número.
 */

export const PASSO_PERCENTO = 5;

export const valorDoToque = (x: number, largura: number): number => {
  if (!Number.isFinite(x) || !Number.isFinite(largura) || largura <= 0) {
    return 0;
  }
  const bruto =
    Math.round(((x / largura) * 100) / PASSO_PERCENTO) * PASSO_PERCENTO;
  return Math.max(0, Math.min(100, bruto));
};
