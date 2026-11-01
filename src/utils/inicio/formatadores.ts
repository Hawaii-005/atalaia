/**
 * Formatadores e derivação de estado da aba Início.
 *
 * Tudo aqui é puro: nada de React, nada de contexto, nada de rede. É o que
 * permite testar as regras do ecrã sem montar componentes, e o que garante que
 * o tablet, o telemóvel e o modo bancada contam a mesma história.
 */

import { formatTicksToReadableTime } from '../tempo';
import { classificarEstado, PrintInfo, EstadoTrabalho } from '../../types';

export type { EstadoTrabalho } from '../../types';

export interface EntradaEstado {
  ligada: boolean;
  printInfo?: PrintInfo | null;
  /** `CurrentTicks` não avançou entre duas leituras: a máquina está em pausa. */
  ticksParados?: boolean;
}

/**
 * Estado a mostrar, a partir do que a máquina reporta.
 *
 * A pausa não tem código próprio: o firmware mantém 6 e os ticks é que param.
 * Por isso a decisão passa por `classificarEstado`, que já trata disso, em vez
 * de ler `Status` directamente.
 */
export const estadoDoTrabalho = ({
  ligada,
  printInfo,
  ticksParados = false,
}: EntradaEstado): EstadoTrabalho => {
  if (!ligada) return 'semLigacao';
  if (printInfo?.ErrorNumber && printInfo.ErrorNumber > 0) return 'erro';

  switch (classificarEstado(printInfo ?? undefined, ticksParados)) {
    case 'printing':
      return 'imprimindo';
    case 'paused':
      return 'pausada';
    case 'preparing':
      return 'preparando';
    case 'completed':
      return 'terminada';
    case 'stopped':
      return 'parada';
    case 'idle':
    case 'unknown':
    default:
      return 'pronta';
  }
};

/** Percentagem dentro de 0..100. `NaN` e infinitos contam como 0. */
export const limitarPercentagem = (valor: number): number => {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(100, valor));
};

/** 42.4 → «42%». */
export const formatarPercentagem = (valor: number): string =>
  `${Math.round(limitarPercentagem(valor))}%`;

/** Segundos que faltam, nunca negativos. */
export const restanteEmSegundos = (printInfo?: PrintInfo | null): number => {
  const total = printInfo?.TotalTicks ?? 0;
  const actual = printInfo?.CurrentTicks ?? 0;
  if (!Number.isFinite(total) || !Number.isFinite(actual)) return 0;
  return Math.max(0, Math.round(total - actual));
};

/** «1h12m», «45m»; null quando já não falta tempo (para o cartão não mostrar «0m»). */
export const formatarRestante = (segundos: number): string | null =>
  segundos > 0 ? formatTicksToReadableTime(segundos) : null;

/** 210 com alvo 210 → «210°» e «/ 210°»; sem alvo, o segundo é null. */
export const formatarTemperatura = (
  valor?: number | null,
  alvo?: number | null
): { valor: string; alvo: string | null } => {
  const arredondar = (n?: number | null) =>
    typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n)}°` : '—°';
  const temAlvo = typeof alvo === 'number' && Number.isFinite(alvo) && alvo > 0;
  return {
    valor: arredondar(valor),
    alvo: temAlvo ? `/ ${arredondar(alvo)}` : null,
  };
};

/** 302.4 → «302 g»; sem valor → «—». */
export const formatarGramas = (gramas?: number | null): string => {
  if (typeof gramas !== 'number' || !Number.isFinite(gramas) || gramas < 0) {
    return '—';
  }
  return `${Math.round(gramas)} g`;
};

/** «12 / 120»; null quando a máquina ainda não sabe as camadas. */
export const formatarCamadas = (
  actual?: number | null,
  total?: number | null
): string | null => {
  const a = Math.max(0, Math.round(actual ?? 0));
  const t = Math.max(0, Math.round(total ?? 0));
  if (t <= 0) return null;
  return `${a} / ${t}`;
};

/**
 * Nome curto de um ficheiro da impressora: «/local//peca_Elegoo PLA_1.2_2h3m.gcode»
 * fica «peca». É o que o histórico mostra; o caminho inteiro não cabe numa linha.
 */
export const nomeDoFicheiro = (ficheiro?: string | null): string => {
  if (!ficheiro) return '';
  return (
    ficheiro
      .split('/')
      .pop()
      ?.replace(/\.gcode$/i, '')
      .replace(/[_-]?Elegoo PLA.*$/i, '')
      .replace(/_[0-9.]+_[0-9]+m[0-9]*s$/i, '')
      .trim() ?? ''
  );
};
