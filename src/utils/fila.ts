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
export {
  CHAVE_ANTIGA,
  CHAVE_FILA,
  VERSAO_FILA,
  carregarFila,
  gravarFila,
  lerEstadoFila,
  lerItem,
  lerItens,
  migrarItemLegado,
} from './fila/armazenamento';
export type { EstadoFila } from './fila/armazenamento';
