/**
 * Ponto de entrada da fila.
 *
 * O modelo e o armazenamento vivem em `./fila/`; este ficheiro mantém os
 * importes antigos (`ItemFila`, `carregarFila`, `gravarFila`) a funcionar.
 */
export type {
  EstadoItem,
  ItemFila,
  MotivoCodigo,
  OpcoesArranque,
} from './fila/modelo';
export {
  ESTADOS,
  ESTADOS_EM_CURSO,
  TransicaoInvalida,
  aguardarAck,
  bloquear,
  cancelar,
  concluir,
  criarItem,
  daImpressora,
  desbloquear,
  ehTerminal,
  iniciarEnvio,
  moverNaFila,
  podeArrancar,
  podeReordenar,
  podeTransitar,
  proximoDaFila,
  registarAck,
  removerPedeConfirmacao,
  sanearAoCarregar,
  semResposta,
  transitar,
} from './fila/modelo';
export type { Contagem, ModoArranque, ModoConfig } from './fila/modos';
export {
  CHAVE_MODOS,
  CONTAGENS,
  MODO_PREDEFINIDO,
  MODOS,
  lerModoConfig,
  lerModos,
  migrarFilaAuto,
  modoDe,
  pedeConfirmacao,
  segundosRestantes,
} from './fila/modos';
export {
  CHAVE_ANTIGA,
  CHAVE_FILA,
  VERSAO_FILA,
  carregarFila,
  carregarModos,
  gravarModos,
  gravarFila,
  lerEstadoFila,
  lerItem,
  lerItens,
  migrarItemLegado,
} from './fila/armazenamento';
export type { EstadoFila } from './fila/armazenamento';
