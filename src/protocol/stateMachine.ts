import { EstadoLogico } from './types';

export interface EntradaEstadoPrinter {
  statusCode: number;
  currentStatus?: number;
  ticks?: number;
  tempNozzle?: number;
  tempTargetNozzle?: number;
  tempBed?: number;
  tempTargetBed?: number;
  isResin?: boolean;
}

/**
 * Função pura que calcula o estado lógico de uma impressora a partir dos dados recebidos.
 * Mapeia os códigos do firmware Centauri (FDM 1.4.49) e Saturn (Resina SDCP V1 1.5.4).
 */
export function calcularEstadoLogico(
  entrada: EntradaEstadoPrinter
): EstadoLogico {
  const {
    statusCode,
    currentStatus,
    isResin,
    tempNozzle = 0,
    tempTargetNozzle = 0,
    tempBed = 0,
    tempTargetBed = 0,
  } = entrada;

  // Saturn (Resina SDCP V1): Se o CurrentStatus for 0 (repouso), o estado lógico é idle
  if (isResin && currentStatus === 0 && statusCode === 0) {
    return 'idle';
  }

  // Códigos de erro
  if (statusCode === 99 || statusCode === 255) {
    return 'error';
  }

  // Códigos de pausa
  if (statusCode === 8 || statusCode === 20) {
    return 'paused';
  }

  // A parar / Parada
  if (statusCode === 10 || statusCode === 14) {
    return 'stopping';
  }

  // Concluída
  if (statusCode === 9 || statusCode === 16) {
    return 'completed';
  }

  // Repouso
  if (statusCode === 0 || statusCode === 7) {
    return 'idle';
  }

  // Se estiver a aquecer (alvo de temperatura definido e ainda >5°C de distância)
  const aquecendoNozzle =
    tempTargetNozzle > 0 && tempTargetNozzle - tempNozzle > 5;
  const aquecendoBed = tempTargetBed > 0 && tempTargetBed - tempBed > 5;

  if (statusCode === 1 || statusCode === 2) {
    if (aquecendoNozzle || aquecendoBed) {
      return 'heating';
    }
    return 'preparing';
  }

  if (statusCode === 3) {
    return 'leveling';
  }

  // Fases de impressão ativas
  if (
    statusCode === 4 ||
    statusCode === 5 ||
    statusCode === 6 ||
    statusCode === 13
  ) {
    return 'printing';
  }

  return 'printing';
}
