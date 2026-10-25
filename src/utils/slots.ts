/**
 * Slots do CANVAS.
 *
 * O fatiador escreve `tray_id: 255` quando não atribui bobina. Se isso fosse
 * directo para a interface aparecia "A256", por isso qualquer valor fora de
 * 0..3 cai no índice da cor (0..3), que é sempre um slot real.
 */
export const slotValido = (valor: unknown, indice: number): number => {
  // Number(null) e Number('') são 0: sem esta guarda, um slot em falta
  // aparecia como A1 em vez de cair no índice da cor.
  if (valor === null || valor === undefined || valor === '') return indice % 4;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 3 ? n : indice % 4;
};

/** Rótulo do slot como a impressora o mostra: 0 → "A1". */
export const rotuloSlot = (slot: number): string => `A${slot + 1}`;
