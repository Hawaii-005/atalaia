/**
 * Duração estimada de um trabalho.
 *
 * A impressora não devolve o tempo estimado no Cmd 258 (lista de ficheiros);
 * o slicer escreve-a no fim do nome — «..._45m14s», «..._4h11m», «..._7m0s».
 * Lê-se daí, e quando o nome não a tem devolve 0 (nunca um número inventado).
 */
const SUFIXO = /[_ ](?:([0-9]+)h)?(?:([0-9]+)m)?(?:([0-9]+)s)?$/;

export const duracaoDoNome = (nome: string): number => {
  const base = String(nome ?? '').replace(/\.gcode$/i, '');
  const achado = base.match(SUFIXO);
  if (!achado || (!achado[1] && !achado[2] && !achado[3])) return 0;
  return (
    Number(achado[1] ?? 0) * 3600 +
    Number(achado[2] ?? 0) * 60 +
    Number(achado[3] ?? 0)
  );
};

/** «45m», «4h 11m» — para quando já há segundos. */
export const formatDuracao = (seg?: number): string => {
  if (!seg || seg <= 0) return '';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
