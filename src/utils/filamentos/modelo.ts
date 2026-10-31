/**
 * Modelo local do filamento.
 *
 * Nada aqui vem do firmware: o CANVAS (Cmd 324) só informa marca, tipo, cor,
 * código e temperaturas de cada slot. Gramas, preço, notas e a ligação a uma
 * bobina física são sempre registo local desta app. Nunca se envia nada para a
 * impressora a partir destes tipos.
 */

/** Percentagem a partir da qual uma bobina é considerada quase no fim. */
export const LIMITE_QUASE_NO_FIM = 15;

/** Slots do CANVAS nesta máquina (0..3, mostrados como A1..A4). */
export const SLOT_MIN = 0;
export const SLOT_MAX = 3;

export interface Spool {
  id: string;
  nome: string;
  marca: string;
  material: string;
  /** Cor em `#rrggbb`. */
  cor: string;
  /** Gramas de fábrica. */
  pesoInicial: number;
  /** Gramas que sobram — conta local, nunca lida da impressora. */
  restante: number;
  /** Preço do rolo inteiro, em euros. 0 = desconhecido. */
  preco: number;
  /** Data de compra em ISO `aaaa-mm-dd` (opcional). */
  dataCompra?: string;
  notas?: string;
  /** Slot do CANVAS a que esta bobina está associada (0..3). */
  canvasSlot?: number;
  /** Impressora a que pertence. */
  printerId: string;
  criadoEm: number;
  /** Arquivada: sai das listas activas mas não perde o histórico. */
  arquivada?: boolean;
}

/**
 * Nome antigo do mesmo tipo. O ecrã de inventário e o painel usam `Rolo`;
 * manter o alias evita duplicar o modelo durante a migração.
 */
export type Rolo = Spool;

export interface Garrafa {
  id: string;
  printerId: string;
  nome: string;
  cor: string;
  volumeInicial: number;
  preco: number;
  restante: number;
  criadoEm: number;
}

/** Consumo de um trabalho que ficou por fechar (sem gramas no ficheiro). */
export interface ConsumoPendente {
  id: string;
  printerId: string;
  filename: string;
  quando: number;
  gramas: number | null;
}

/** Perfil de material: só consulta, não se envia à impressora. */
export interface FilamentProfile {
  material: string;
  tempBicoMin: number;
  tempBicoMax: number;
  tempMesa: number;
  notas?: string;
}

/** Registo de consumo já aplicado a uma bobina. */
export interface UsageRecord {
  id: string;
  /**
   * Id do trabalho (`PrintInfo.TaskId`) ou, quando a impressora não o dá, um
   * id local estável. É o que garante que o mesmo trabalho não desconta duas
   * vezes ao reabrir a app.
   */
  jobId: string;
  printerId: string;
  spoolId: string;
  gramas: number;
  custo: number;
  quando: number;
}
