/**
 * Utilitários para a pré-visualização progressiva da impressão em resina.
 * Funções puras, sem dependências de React Native.
 */

/** Estados possíveis da pré-visualização. */
export type EstadoPrevia =
  | 'sem-ligacao'
  | 'a-imprimir'
  | 'em-pausa'
  | 'concluida'
  | 'parada'
  | 'repouso';

/**
 * Limita e normaliza um valor de progresso para 0..100 com uma casa decimal.
 * undefined, null, NaN ou negativo → 0.
 */
export function limitarProgresso(p: unknown): number {
  if (p === undefined || p === null) return 0;
  const n = Number(p);
  if (Number.isNaN(n) || n <= 0) return 0;
  if (n >= 100) return 100;
  return Math.round(n * 10) / 10;
}

/**
 * Altura já revelada (impressa) em dp.
 * progresso: 0..100 (já limitado por limitarProgresso).
 * altura: altura total da pré-visualização em dp.
 */
export function alturaRevelada(progresso: number, altura: number): number {
  return (limitarProgresso(progresso) / 100) * altura;
}

/**
 * Posição top (em dp) da frente de impressão, medida a partir do topo do contentor.
 * Quando progresso = 0 → top = altura (fora de vista, no fundo).
 * Quando progresso = 100 → top = 0 (no topo).
 */
export function topoFrente(progresso: number, altura: number): number {
  return altura - alturaRevelada(progresso, altura);
}

/**
 * Determina o estado da pré-visualização a partir do status numérico da impressora
 * e da flag de ligação.
 *
 * Regras (ordem de prioridade):
 * 1. !ligada → 'sem-ligacao'
 * 2. status === 6 → 'a-imprimir'
 * 3. status === 20 → 'em-pausa'
 * 4. status === 9 → 'concluida'
 * 5. status === 8 → 'parada'
 * 6. resto → 'repouso'
 */
export function estadoDaPrevia(
  status: number | null | undefined,
  ligada: boolean
): EstadoPrevia {
  if (!ligada) return 'sem-ligacao';
  const s = status ?? 0;
  switch (s) {
    case 6:
      return 'a-imprimir';
    case 20:
      return 'em-pausa';
    case 9:
      return 'concluida';
    case 8:
      return 'parada';
    default:
      return 'repouso';
  }
}
