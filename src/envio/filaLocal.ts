/**
 * Ligação (só de leitura) entre a Fila local existente e o envio COSMOS.
 *
 * A Fila SDCP não é tocada: continua a mandar nos seus estados e no Ack. Aqui
 * só se responde a uma pergunta — «este item pode passar a `aEnviar` agora?» —
 * com as mesmas regras que a fila já usa: nada em curso nesta impressora e o
 * primeiro pendente por ordem.
 */

import {
  ESTADOS_EM_CURSO,
  proximoDaFila,
  type ItemFila,
} from '../utils/fila/modelo';

/**
 * Item que pode arrancar nesta impressora, ou `null` se houver trabalho em
 * curso (aí é a vez dele, não deste) ou nada pendente.
 */
export const proximoAEnviar = (
  itens: ItemFila[],
  printerId: string
): ItemFila | null => {
  const emCurso = itens.some(
    item =>
      item.printerId === printerId && ESTADOS_EM_CURSO.includes(item.estado)
  );
  if (emCurso) return null;
  return proximoDaFila(itens, printerId) ?? null;
};

/** O item da fila já alguma vez pediu arranque? (trava o duplo arranque) */
export const arranqueJaPedido = (item: ItemFila): boolean =>
  item.arranqueTentado;
