/**
 * Persistência da fila.
 *
 * Esquema versionado (`atalaia.fila.v2`). A lista antiga (`filaImpressao`) só
 * tinha `{id, printerId, name, label}`: é migrada uma vez, pela ordem em que
 * estava, e apagada depois de a versão nova estar gravada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../log';
import {
  ESTADOS,
  EstadoItem,
  ItemFila,
  MotivoCodigo,
  OpcoesArranque,
  sanearAoCarregar,
} from './modelo';
import {
  CHAVE_FILA_AUTO,
  CHAVE_MODOS,
  ModoConfig,
  lerModos,
  migrarFilaAuto,
} from './modos';

export const VERSAO_FILA = 2;
export const CHAVE_FILA = 'atalaia.fila.v2';
export const CHAVE_ANTIGA = 'filaImpressao';

export interface EstadoFila {
  versao: number;
  itens: ItemFila[];
}

const ehEstado = (valor: unknown): valor is EstadoItem =>
  typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor);

const numero = (valor: unknown, omissao = 0): number =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : omissao;

const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor.length > 0 ? valor : undefined;

const lerOpcoes = (cru: unknown): OpcoesArranque => {
  const o = (cru ?? {}) as Record<string, unknown>;
  return {
    nivelar: o.nivelar === true,
    // A fila antiga arrancava sempre com lado 0; manter isso na migração.
    lado: numero(o.lado ?? 0) === 1 ? 1 : 0,
    ...(Array.isArray(o.slotMap) ? { slotMap: o.slotMap } : {}),
  };
};

/**
 * Lê um item guardado. Campos em falta ganham valores seguros: um item que já
 * foi enviado nunca perde a marca `arranqueTentado` por o registo estar
 * incompleto.
 */
export const lerItem = (cru: unknown): ItemFila | null => {
  if (!cru || typeof cru !== 'object') return null;
  const i = cru as Record<string, unknown>;
  const id = texto(i.id);
  const printerId = texto(i.printerId);
  const name = texto(i.name);
  if (!id || !printerId || !name) return null;
  const estado = ehEstado(i.estado) ? i.estado : 'pendente';
  const criadoEm = numero(i.criadoEm);
  return {
    id,
    printerId,
    name,
    label: texto(i.label) ?? name,
    estado,
    criadoEm,
    atualizadoEm: numero(i.atualizadoEm, criadoEm),
    arranqueTentado: i.arranqueTentado === true,
    ...(texto(i.tentativaId) ? { tentativaId: texto(i.tentativaId) } : {}),
    ...(typeof i.tentativaEm === 'number'
      ? { tentativaEm: numero(i.tentativaEm) }
      : {}),
    tentativas: numero(i.tentativas),
    ...(texto(i.motivo) ? { motivo: texto(i.motivo) as MotivoCodigo } : {}),
    ...(typeof i.ackCode === 'number' ? { ackCode: numero(i.ackCode) } : {}),
    ...(typeof i.tamanho === 'number' ? { tamanho: numero(i.tamanho) } : {}),
    ...(typeof i.duracaoSeg === 'number'
      ? { duracaoSeg: numero(i.duracaoSeg) }
      : {}),
    ...(texto(i.miniatura) ? { miniatura: texto(i.miniatura) } : {}),
    opcoes: lerOpcoes(i.opcoes),
  };
};

/** Item da lista antiga, ainda sem estado nem opções. */
export const migrarItemLegado = (
  cru: unknown,
  agora: number
): ItemFila | null => {
  if (!cru || typeof cru !== 'object') return null;
  const i = cru as Record<string, unknown>;
  const id = texto(i.id);
  const printerId = texto(i.printerId);
  const name = texto(i.name);
  if (!id || !printerId || !name) return null;
  return {
    id,
    printerId,
    name,
    label: texto(i.label) ?? name,
    estado: 'pendente',
    criadoEm: numero(i.criadoEm, agora),
    atualizadoEm: agora,
    arranqueTentado: false,
    tentativas: 0,
    opcoes: { nivelar: false, lado: 0 },
  };
};

export const lerItens = (cru: unknown, agora = Date.now()): ItemFila[] => {
  if (!Array.isArray(cru)) return [];
  return cru
    .map(item => lerItem(item) ?? migrarItemLegado(item, agora))
    .filter((item): item is ItemFila => item !== null);
};

/** Aceita a versão 2, a lista antiga (array simples) ou lixo. */
export const lerEstadoFila = (cru: unknown, agora = Date.now()): EstadoFila => {
  if (Array.isArray(cru)) {
    return { versao: VERSAO_FILA, itens: lerItens(cru, agora) };
  }
  if (cru && typeof cru === 'object') {
    const estado = cru as Record<string, unknown>;
    return {
      versao: numero(estado.versao, VERSAO_FILA),
      itens: lerItens(estado.itens, agora),
    };
  }
  return { versao: VERSAO_FILA, itens: [] };
};

const lerJson = (texto?: string | null): unknown => {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (erro) {
    log('fila: JSON inválido', erro);
    return null;
  }
};

/**
 * Carrega a fila. Se só existir a lista antiga, migra-a e apaga-a; se houver
 * itens apanhados a meio de um envio, deixa-os bloqueados (nunca os reenvia).
 */
export const carregarFila = async (agora = Date.now()): Promise<ItemFila[]> => {
  try {
    const guardado = await AsyncStorage.getItem(CHAVE_FILA);
    if (guardado !== null) {
      const estado = lerEstadoFila(lerJson(guardado), agora);
      const saneados = sanearAoCarregar(estado.itens, agora);
      if (saneados.some((item, i) => item.estado !== estado.itens[i].estado)) {
        await gravarFila(saneados);
      }
      return saneados;
    }

    const antigo = await AsyncStorage.getItem(CHAVE_ANTIGA);
    if (antigo === null) return [];
    const migrados = lerItens(lerJson(antigo), agora);
    await gravarFila(migrados);
    await AsyncStorage.removeItem(CHAVE_ANTIGA).catch(() => undefined);
    return migrados;
  } catch (erro) {
    log('fila: não consegui ler', erro);
    return [];
  }
};

export const gravarFila = async (itens: ItemFila[]): Promise<void> => {
  try {
    const estado: EstadoFila = { versao: VERSAO_FILA, itens };
    await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(estado));
  } catch (erro) {
    log('fila: não consegui gravar', erro);
  }
};

/** Modos de arranque por impressora, migrando o `filaAuto` antigo. */
export const carregarModos = async (): Promise<Record<string, ModoConfig>> => {
  try {
    const guardado = await AsyncStorage.getItem(CHAVE_MODOS);
    if (guardado !== null) return lerModos(lerJson(guardado));
    const antigo = await AsyncStorage.getItem(CHAVE_FILA_AUTO);
    const migrado = migrarFilaAuto(antigo);
    // Não há impressoras conhecidas neste ponto: guarda-se só a intenção e o
    // contexto aplica-a quando souber os ids.
    return { '*': migrado };
  } catch (erro) {
    log('fila: não consegui ler os modos', erro);
    return {};
  }
};

export const gravarModos = async (
  modos: Record<string, ModoConfig>
): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHAVE_MODOS, JSON.stringify(modos));
  } catch (erro) {
    log('fila: não consegui gravar os modos', erro);
  }
};
