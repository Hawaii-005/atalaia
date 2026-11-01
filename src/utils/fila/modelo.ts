/**
 * Modelo da fila de impressão.
 *
 * Máquina de estados explícita e pura: nenhuma função aqui fala com a rede, com
 * o armazenamento ou com o React. Cada item tem um `id` estável e uma marca de
 * «arranque tentado» — é isso que impede que o mesmo trabalho seja enviado duas
 * vezes depois de um erro, de um Ack tardio ou de a app ser fechada a meio.
 *
 * O protocolo SDCP não é tocado: isto só decide em que estado a app acredita.
 */

/** Estados possíveis de um item. */
export const ESTADOS = [
  'pendente',
  'aEnviar',
  'aEsperaAck',
  'aImprimir',
  'concluido',
  'falhou',
  'cancelado',
  'bloqueado',
] as const;

export type EstadoItem = (typeof ESTADOS)[number];

/** Estados em que já saiu um comando para a impressora. */
export const ESTADOS_EM_CURSO: EstadoItem[] = [
  'aEnviar',
  'aEsperaAck',
  'aImprimir',
];

export type MotivoCodigo =
  | 'envioInterrompido'
  | 'impressoraOcupada'
  | 'semLigacao'
  | 'estadoAntigo'
  | 'impressaoAnteriorFalhou'
  | 'ficheiroIncompativel'
  | 'materialInsuficiente'
  | 'ackRecusado';

/** Opções de arranque escolhidas quando o item entrou na fila. */
export interface OpcoesArranque {
  nivelar: boolean;
  lado: 0 | 1;
  /** Escolhido no momento de imprimir; fica vazio ao pôr na fila. */
  slotMap?: unknown[];
}

export interface ItemFila {
  /** Estável: não muda em retomas nem depois de reabrir a app. */
  id: string;
  printerId: string;
  /** Nome que a impressora conhece (é o que vai no comando). */
  name: string;
  label: string;
  estado: EstadoItem;
  criadoEm: number;
  atualizadoEm: number;
  /** Já se enviou pelo menos um comando de arranque para este item. */
  arranqueTentado: boolean;
  /** Identifica a tentativa em curso; um Ack de outra tentativa é ignorado. */
  tentativaId?: string;
  tentativaEm?: number;
  /** Quantas vezes a impressora recusou (Ack > 0). */
  tentativas: number;
  /** Último motivo conhecido, como código — o texto é da i18n. */
  motivo?: MotivoCodigo;
  ackCode?: number;
  tamanho?: number;
  /** Vem do sufixo do slicer no nome; 0 quando não se sabe. */
  duracaoSeg?: number;
  /** Nome do ficheiro de miniatura na cache da app. */
  miniatura?: string;
  opcoes: OpcoesArranque;
}

export class TransicaoInvalida extends Error {
  constructor(
    readonly de: EstadoItem,
    readonly para: EstadoItem
  ) {
    super(`transição inválida: ${de} → ${para}`);
    this.name = 'TransicaoInvalida';
  }
}

/**
 * Transições aceites. Tudo o que não está aqui é rejeitado — é assim que um
 * Ack tardio ou um segundo toque não conseguem mexer no estado.
 */
const TRANSICOES: Record<EstadoItem, EstadoItem[]> = {
  pendente: ['aEnviar', 'bloqueado', 'cancelado'],
  bloqueado: ['pendente', 'cancelado'],
  aEnviar: ['aEsperaAck', 'pendente', 'falhou', 'bloqueado', 'cancelado'],
  aEsperaAck: ['aImprimir', 'pendente', 'falhou', 'bloqueado', 'cancelado'],
  aImprimir: ['concluido', 'falhou', 'cancelado'],
  // Terminais: saem da fila; ficam no histórico.
  concluido: [],
  falhou: ['pendente', 'cancelado'],
  cancelado: ['pendente'],
};

export const podeTransitar = (de: EstadoItem, para: EstadoItem): boolean =>
  TRANSICOES[de].includes(para);

export const ehTerminal = (estado: EstadoItem): boolean =>
  estado === 'concluido';

export const podeArrancar = (item: ItemFila): boolean =>
  item.estado === 'pendente';

export interface CriarItem {
  id: string;
  printerId: string;
  name: string;
  label: string;
  agora: number;
  opcoes: OpcoesArranque;
  tamanho?: number;
  duracaoSeg?: number;
  miniatura?: string;
}

export const criarItem = (dados: CriarItem): ItemFila => ({
  id: dados.id,
  printerId: dados.printerId,
  name: dados.name,
  label: dados.label,
  estado: 'pendente',
  criadoEm: dados.agora,
  atualizadoEm: dados.agora,
  arranqueTentado: false,
  tentativas: 0,
  opcoes: { ...dados.opcoes },
  ...(dados.tamanho !== undefined ? { tamanho: dados.tamanho } : {}),
  ...(dados.duracaoSeg !== undefined ? { duracaoSeg: dados.duracaoSeg } : {}),
  ...(dados.miniatura !== undefined ? { miniatura: dados.miniatura } : {}),
});

/** Aplica uma transição válida. Lança `TransicaoInvalida` quando não é. */
export const transitar = (
  item: ItemFila,
  para: EstadoItem,
  agora: number,
  alteracoes: Partial<ItemFila> = {}
): ItemFila => {
  if (!podeTransitar(item.estado, para)) {
    throw new TransicaoInvalida(item.estado, para);
  }
  return { ...item, ...alteracoes, estado: para, atualizadoEm: agora };
};

export type ResultadoInicio =
  | { ok: true; item: ItemFila }
  | { ok: false; motivo: 'estado' | 'jaTentado' | 'semTentativa' };

/**
 * Começa um envio. Só a partir de `pendente`: um item que já está a enviar, à
 * espera de Ack, a imprimir ou terminado nunca recomeça por engano.
 */
export const iniciarEnvio = (
  item: ItemFila,
  tentativaId: string,
  agora: number
): ResultadoInicio => {
  if (!tentativaId) return { ok: false, motivo: 'semTentativa' };
  if (!podeArrancar(item)) return { ok: false, motivo: 'estado' };
  const aEnviar = transitar(item, 'aEnviar', agora, {
    arranqueTentado: true,
    tentativaId,
    tentativaEm: agora,
    motivo: undefined,
    ackCode: undefined,
  });
  return { ok: true, item: aEnviar };
};

/** Passa de «a enviar» para «à espera de Ack», com a mesma tentativa. */
export const aguardarAck = (
  item: ItemFila,
  tentativaId: string,
  agora: number
): ItemFila => {
  if (item.tentativaId !== tentativaId || item.estado !== 'aEnviar') {
    throw new TransicaoInvalida(item.estado, 'aEsperaAck');
  }
  return transitar(item, 'aEsperaAck', agora);
};

export interface ResultadoAck {
  item: ItemFila;
  /** `false` quando o Ack é de uma tentativa antiga ou duplicado. */
  aplicado: boolean;
}

/**
 * Regista a resposta da impressora. Um Ack que chegue depois de outra tentativa
 * (ou repetido) é ignorado — é o que evita arrancar duas vezes com uma resposta
 * atrasada.
 */
export const registarAck = (
  item: ItemFila,
  tentativaId: string,
  ack: number,
  agora: number,
  maxTentativas = 3
): ResultadoAck => {
  if (item.estado !== 'aEsperaAck' || item.tentativaId !== tentativaId) {
    return { item, aplicado: false };
  }
  if (ack === 0) {
    return {
      item: transitar(item, 'aImprimir', agora, {
        ackCode: 0,
        motivo: undefined,
      }),
      aplicado: true,
    };
  }
  const tentativas = item.tentativas + 1;
  if (tentativas >= maxTentativas) {
    return {
      item: transitar(item, 'falhou', agora, {
        ackCode: ack,
        motivo: 'ackRecusado',
        tentativas,
      }),
      aplicado: true,
    };
  }
  return {
    item: transitar(item, 'pendente', agora, {
      ackCode: ack,
      motivo: 'ackRecusado',
      tentativas,
      tentativaId: undefined,
    }),
    aplicado: true,
  };
};

/**
 * Sem resposta da impressora não se repete o comando: pode ter sido aceite e a
 * resposta ter-se perdido. Fica bloqueado à espera de reconciliação.
 */
export const semResposta = (
  item: ItemFila,
  agora: number,
  motivo: MotivoCodigo = 'envioInterrompido'
): ItemFila =>
  transitar(item, 'bloqueado', agora, {
    motivo,
    tentativaId: undefined,
  });

export const bloquear = (
  item: ItemFila,
  motivo: MotivoCodigo,
  agora: number
): ItemFila =>
  transitar(item, 'bloqueado', agora, { motivo, tentativaId: undefined });

export const desbloquear = (item: ItemFila, agora: number): ItemFila =>
  transitar(item, 'pendente', agora, { motivo: undefined });

export const cancelar = (item: ItemFila, agora: number): ItemFila =>
  transitar(item, 'cancelado', agora, { tentativaId: undefined });

export const concluir = (item: ItemFila, agora: number): ItemFila =>
  transitar(item, 'concluido', agora);

/**
 * Ao abrir a app, um item apanhado a meio do envio não pode voltar a ser
 * enviado às cegas: fica bloqueado com o motivo, à espera de reconciliação.
 */
export const sanearAoCarregar = (
  itens: ItemFila[],
  agora: number
): ItemFila[] =>
  itens.map(item => {
    if (item.estado === 'aEnviar' || item.estado === 'aEsperaAck') {
      return {
        ...item,
        estado: 'bloqueado',
        motivo: 'envioInterrompido',
        tentativaId: undefined,
        atualizadoEm: agora,
      };
    }
    return item;
  });

/** Primeiro item que pode arrancar nesta impressora. */
export const proximoDaFila = (
  itens: ItemFila[],
  printerId: string
): ItemFila | undefined =>
  itens.find(
    item => item.printerId === printerId && item.estado === 'pendente'
  );

export const daImpressora = (
  itens: ItemFila[],
  printerId: string
): ItemFila[] => itens.filter(item => item.printerId === printerId);

/**
 * Move um item dentro da fila da sua impressora. Devolve a lista completa, com
 * os itens das outras impressoras intactos e na mesma posição relativa.
 */
export const moverNaFila = (
  itens: ItemFila[],
  id: string,
  destino: number
): ItemFila[] => {
  const item = itens.find(i => i.id === id);
  if (!item) return itens;
  const daMesma = itens.filter(i => i.printerId === item.printerId);
  const indice = daMesma.findIndex(i => i.id === id);
  if (indice < 0) return itens;
  const alvo = Math.max(0, Math.min(daMesma.length - 1, destino));
  if (alvo === indice) return itens;
  const reordenada = [...daMesma];
  reordenada.splice(indice, 1);
  reordenada.splice(alvo, 0, item);

  let cursor = 0;
  return itens.map(i =>
    i.printerId === item.printerId ? reordenada[cursor++] : i
  );
};

/** Só estes estados podem ser arrastados. */
export const podeReordenar = (item: ItemFila): boolean =>
  item.estado === 'pendente' || item.estado === 'bloqueado';

/** Remover a imprimir exige confirmação; os restantes não. */
export const removerPedeConfirmacao = (item: ItemFila): boolean =>
  ESTADOS_EM_CURSO.includes(item.estado);
