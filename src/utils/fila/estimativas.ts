/**
 * Estimativas da fila.
 *
 * A duração de cada item vem do sufixo do slicer no nome do ficheiro
 * (`duracaoDoNome`). Quando um item não a tem, os seguintes ficam sem hora —
 * não se inventa um tempo só para o cartão ficar bonito.
 */
import { ItemFila } from './modelo';

export interface EstimativaItem {
  duracaoSeg?: number;
  /** Epoch em ms; só existe quando todas as durações anteriores são conhecidas. */
  inicio?: number;
  fim?: number;
}

export interface EstimativaFila {
  itens: Record<string, EstimativaItem>;
  /** Soma das durações conhecidas (não é o tempo até ao fim se faltar alguma). */
  totalSeg: number;
  /** `true` quando todos os itens têm duração conhecida. */
  completa: boolean;
  contagem: number;
}

export const estimarFila = (
  itens: ItemFila[],
  agora: number
): EstimativaFila => {
  let cursor: number | undefined = agora;
  let totalSeg = 0;
  let completa = itens.length > 0;
  const mapa: Record<string, EstimativaItem> = {};

  itens.forEach(item => {
    const duracaoSeg =
      typeof item.duracaoSeg === 'number' && item.duracaoSeg > 0
        ? item.duracaoSeg
        : undefined;

    if (duracaoSeg === undefined) {
      completa = false;
      mapa[item.id] = {};
      // Sem esta duração não há como datar as seguintes com honestidade.
      cursor = undefined;
      return;
    }

    totalSeg += duracaoSeg;
    if (cursor === undefined) {
      mapa[item.id] = { duracaoSeg };
      return;
    }
    const fim = cursor + duracaoSeg * 1000;
    mapa[item.id] = { duracaoSeg, inicio: cursor, fim };
    cursor = fim;
  });

  return { itens: mapa, totalSeg, completa, contagem: itens.length };
};

/** «14:10» no idioma da app; devolve `undefined` quando não há hora. */
export const formatarHora = (
  epoch: number | undefined,
  locale: string
): string | undefined => {
  if (epoch === undefined || !Number.isFinite(epoch)) return undefined;
  return new Date(epoch).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
};
