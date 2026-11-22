/**
 * Comparação entre o G-code local e os metadados que o Moonraker extrai do
 * ficheiro já enviado. Puro: não lê ficheiros nem fala com a impressora.
 */

export type ResumoLocal = {
  bytes: number;
  camadas: number;
  /** Tempo do cabeçalho em segundos; `null` quando o slicer não o escreveu. */
  tempoSeg: number | null;
};

export type MetadadosRemotos = {
  tamanho: number | null;
  camadas: number | null;
  tempoSeg: number | null;
};

export type Comparacao = 'igual' | 'diferente' | 'indeterminado';

/** Tolerância no tempo: o Moonraker recalcula-o a partir do próprio G-code. */
export const TOLERANCIA_TEMPO_SEG = 60;

/** "1h 48m 3s" / "12m 2s" / "8m" → segundos. */
export const tempoEmSegundos = (
  texto: string | null | undefined
): number | null => {
  if (!texto) return null;
  const horas = /(\d+)\s*h/i.exec(texto);
  const minutos = /(\d+)\s*m/i.exec(texto);
  const segundos = /(\d+)\s*s/i.exec(texto);
  if (!horas && !minutos && !segundos) return null;
  return (
    (horas ? Number(horas[1]) * 3600 : 0) +
    (minutos ? Number(minutos[1]) * 60 : 0) +
    (segundos ? Number(segundos[1]) : 0)
  );
};

/**
 * Tamanho e camadas têm de ser exactos; o tempo admite [tolerancia].
 * Um campo que o Moonraker ainda não tem deixa a comparação `indeterminado`:
 * não se declara «verificado» sem dados.
 */
export const compararMetadados = (
  local: ResumoLocal,
  remoto: MetadadosRemotos,
  tolerancia = TOLERANCIA_TEMPO_SEG
): Comparacao => {
  if (remoto.tamanho !== null && remoto.tamanho !== local.bytes) {
    return 'diferente';
  }
  if (remoto.camadas !== null && remoto.camadas !== local.camadas) {
    return 'diferente';
  }
  if (local.tempoSeg !== null && remoto.tempoSeg !== null) {
    if (Math.abs(local.tempoSeg - remoto.tempoSeg) > tolerancia) {
      return 'diferente';
    }
  }
  if (
    remoto.tamanho === null ||
    remoto.camadas === null ||
    (local.tempoSeg !== null && remoto.tempoSeg === null)
  ) {
    return 'indeterminado';
  }
  return 'igual';
};
