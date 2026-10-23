/**
 * Utilitários puros para o componente Estratos — sem dependências de React.
 */

export type TipoEstrato = 'fdm' | 'resina';
export const CAMADAS_DESENHADAS = 72;

/**
 * Meia-largura (em unidades do viewBox, 0..150) da camada i de n.
 *
 * Perfis determinísticos (sem Math.random):
 * - FDM: vaso — estreito em baixo, largo ao meio, afunila em cima.
 * - Resina: figura — base larga, cintura, ombros, cabeça.
 *
 * Resultado sempre limitado a [26, 150].
 */
export function meiaLargura(i: number, n: number, tipo: TipoEstrato): number {
  const idx = Math.max(0, Math.min(i, n - 1));
  const total = Math.max(1, n - 1);
  const t = idx / total; // 0..1

  let largura: number;

  if (tipo === 'fdm') {
    // Vaso: seno simples — 26 nas extremidades, 150 no centro.
    largura = 26 + 124 * Math.sin(Math.PI * t);
  } else {
    // Figura: base larga, cintura, ombros, cabeça.
    // Combina uma afunilação linear com gaussianas para cintura/ombros/pescoço.
    const base = 140 * (1 - t);           // 140 → 0
    const cintura = -60 * Math.exp(-50 * (t - 0.25) ** 2); // cava em t=0.25
    const ombros = 50 * Math.exp(-30 * (t - 0.5) ** 2);    // saliência em t=0.5
    const pescoco = -40 * Math.exp(-50 * (t - 0.75) ** 2); // cava em t=0.75
    const cabeca = 30;                                    // topo constante
    largura = base + cintura + ombros + pescoco + cabeca;
  }

  // Limitar a [26, 150] e arredondar a inteiro (viewBox usa coordenadas inteiras).
  return Math.max(26, Math.min(150, Math.round(largura)));
}

/**
 * Quantas camadas já estão postas, 0..n. Nunca negativo, nunca acima de n.
 *
 * - Se total > 0: usa actual/total.
 * - Senão: usa progresso/100.
 * - Resultado arredondado e limitado a [0, n].
 * - total = 0 e progresso = 0 → 0.
 * - progresso = 100 → n.
 * - Valores negativos ou NaN → 0.
 */
export function camadasPostas(
  actual: number,
  total: number,
  progresso: number,
  n = CAMADAS_DESENHADAS
): number {
  let fracao: number;

  if (total > 0) {
    fracao = actual / total;
  } else {
    fracao = progresso / 100;
  }

  // Tratar NaN, null, undefined, negativos.
  if (!Number.isFinite(fracao) || fracao < 0) {
    return 0;
  }

  const postas = Math.round(fracao * n);
  return Math.max(0, Math.min(n, postas));
}