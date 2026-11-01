/**
 * Tradução do estado cru da impressora para os estados que a UI usa.
 *
 * Não inventa nada: segue o mapa de `getPrintStatus` (`src/types/index.ts`) e a
 * regra verificada no código de que a pausa não tem código próprio — continua
 * `6` e o que para é o `CurrentTicks`.
 */
import { getPrintStatus } from '../../types';
import { EstadoImpressora, LIMITE_ESTADO_ANTIGO_MS } from './capacidades';

/** Tempo com os ticks parados a partir do qual se considera pausa. */
export const LIMITE_TICKS_PARADOS_MS = 45_000;

export const estadoDeInfo = (
  status: number | null | undefined,
  ligada: boolean,
  idadeEstadoMs: number | null,
  paradoHaMs: number | null = null
): EstadoImpressora => {
  if (!ligada) return 'sem-ligacao';
  if (idadeEstadoMs === null || idadeEstadoMs > LIMITE_ESTADO_ANTIGO_MS) {
    return 'estado-antigo';
  }

  switch (getPrintStatus(status ?? 0)) {
    case 'printing':
      return paradoHaMs !== null && paradoHaMs > LIMITE_TICKS_PARADOS_MS
        ? 'em-pausa'
        : 'a-imprimir';
    case 'preparing':
      return 'a-preparar';
    case 'idle':
    case 'stopped':
    case 'completed':
      return 'ociosa';
    default:
      // Status desconhecido: trata-se como erro para bloquear o que é perigoso.
      return 'erro';
  }
};
