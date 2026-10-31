/**
 * Matemática do relógio de 24 horas — ângulos, pontos, arcos SVG e ordenação.
 * Tudo em hora decimal (0..24), com 0 h no topo e sentido horário.
 */

export interface TrabalhoRelogio {
  id: string;
  nome: string;
  /** hora decimal 0..24 em que começou */
  inicio: number;
  /** hora decimal 0..24 em que acaba */
  fim: number;
  /** cor já resolvida, ex.: '#3E6AE1' */
  cor: string;
}

/**
 * Ângulo em radianos, com 0 h no topo e sentido horário.
 * 0 h → -π/2, 6 h → 0, 12 h → π/2, 18 h → π
 */
export function anguloHora(h: number): number {
  const normalizada = ((h % 24) + 24) % 24;
  return (normalizada / 24) * 2 * Math.PI - Math.PI / 2;
}

/**
 * Ponto no círculo: [x, y].
 * Com 0 h no topo (y mínimo) e sentido horário.
 */
export function pontoHora(
  h: number,
  raio: number,
  cx: number,
  cy: number
): [number, number] {
  const angulo = anguloHora(h);
  const x = cx + raio * Math.cos(angulo);
  const y = cy + raio * Math.sin(angulo);
  return [x, y];
}

/**
 * Path SVG de um arco entre duas horas, no raio dado.
 * Devolve string vazia se h1 === h2.
 * Usa large-arc-flag = 1 quando o arco é maior que 12 h.
 */
export function arcoSvg(
  h1: number,
  h2: number,
  raio: number,
  cx: number,
  cy: number
): string {
  const n1 = ((h1 % 24) + 24) % 24;
  const n2 = ((h2 % 24) + 24) % 24;

  if (n1 === n2) return '';

  const [x1, y1] = pontoHora(n1, raio, cx, cy);
  const [x2, y2] = pontoHora(n2, raio, cx, cy);

  let delta = n2 - n1;
  if (delta < 0) delta += 24;

  const largeArc = delta > 12 ? 1 : 0;

  return `M ${x1.toFixed(3)} ${y1.toFixed(3)} A ${raio.toFixed(3)} ${raio.toFixed(3)} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}

/**
 * Trabalhos ordenados pelo fim (mais cedo primeiro).
 * Não muta o array original.
 */
export function ordenarPorFim(t: TrabalhoRelogio[]): TrabalhoRelogio[] {
  return [...t].sort((a, b) => a.fim - b.fim);
}

/**
 * Trabalho que acaba primeiro entre os que ainda não acabaram, ou null.
 * Considera acabado se agora >= fim.
 */
export function proximoAFim(
  t: TrabalhoRelogio[],
  agora: number
): TrabalhoRelogio | null {
  const naoAcabados = t.filter(trabalho => agora < trabalho.fim);
  if (naoAcabados.length === 0) return null;

  return naoAcabados.reduce((proximo, trabalho) =>
    trabalho.fim < proximo.fim ? trabalho : proximo
  );
}
