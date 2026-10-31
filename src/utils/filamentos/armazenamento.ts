/**
 * Armazenamento local do filamento, com versão de esquema e migração.
 *
 * A chave nova é `atalaia.filamentos.v2`. A chave antiga
 * (`atalaia.inventario.v1`, com `rolos`/`garrafas`/`pendentes`) é lida uma vez
 * para migrar e **não é apagada**: se algo correr mal, os dados antigos
 * continuam lá.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../log';
import {
  ConsumoPendente,
  FilamentProfile,
  Garrafa,
  Spool,
  UsageRecord,
} from './modelo';
import { normalizarHex, slotValidoOuIndefinido } from './operacoes';

export const VERSAO_ESQUEMA = 2;
export const CHAVE = 'atalaia.filamentos.v2';
export const CHAVE_LEGADA = 'atalaia.inventario.v1';

export interface EstadoFilamentos {
  versao: number;
  bobinas: Spool[];
  garrafas: Garrafa[];
  pendentes: ConsumoPendente[];
  perfis: FilamentProfile[];
  usos: UsageRecord[];
}

export const estadoVazio = (): EstadoFilamentos => ({
  versao: VERSAO_ESQUEMA,
  bobinas: [],
  garrafas: [],
  pendentes: [],
  perfis: [],
  usos: [],
});

const lista = (valor: unknown): unknown[] =>
  Array.isArray(valor) ? valor : [];

const texto = (valor: unknown, defeito = ''): string =>
  typeof valor === 'string' ? valor : defeito;

const numero = (valor: unknown, defeito = 0): number => {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : defeito;
};

const booleano = (valor: unknown): boolean => valor === true;

const sanitizarBobina = (bruto: unknown): Spool | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const dados = bruto as Record<string, unknown>;
  const id = texto(dados.id);
  const printerId = texto(dados.printerId);
  if (!id || !printerId) return null;

  const pesoInicial = Math.max(0, numero(dados.pesoInicial));
  const restante = Math.max(
    0,
    Math.min(pesoInicial || Infinity, numero(dados.restante, pesoInicial))
  );

  return {
    id,
    nome: texto(dados.nome) || 'Sem nome',
    marca: texto(dados.marca),
    material: texto(dados.material, 'PLA').toUpperCase(),
    cor: normalizarHex(texto(dados.cor)) ?? '#808080',
    pesoInicial,
    restante,
    preco: Math.max(0, numero(dados.preco)),
    dataCompra: texto(dados.dataCompra) || undefined,
    notas: texto(dados.notas) || undefined,
    canvasSlot: slotValidoOuIndefinido(dados.canvasSlot),
    printerId,
    criadoEm: numero(dados.criadoEm, Date.now()),
    arquivada: booleano(dados.arquivada) || undefined,
  };
};

const sanitizarGarrafa = (bruto: unknown): Garrafa | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const dados = bruto as Record<string, unknown>;
  const id = texto(dados.id);
  const printerId = texto(dados.printerId);
  if (!id || !printerId) return null;
  const volumeInicial = Math.max(0, numero(dados.volumeInicial));
  return {
    id,
    printerId,
    nome: texto(dados.nome) || 'Sem nome',
    cor: normalizarHex(texto(dados.cor)) ?? '#808080',
    volumeInicial,
    preco: Math.max(0, numero(dados.preco)),
    restante: Math.max(
      0,
      Math.min(volumeInicial || Infinity, numero(dados.restante, volumeInicial))
    ),
    criadoEm: numero(dados.criadoEm, Date.now()),
  };
};

const sanitizarPendente = (bruto: unknown): ConsumoPendente | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const dados = bruto as Record<string, unknown>;
  const id = texto(dados.id);
  const printerId = texto(dados.printerId);
  if (!id || !printerId) return null;
  const gramas = dados.gramas === null ? null : numero(dados.gramas);
  return {
    id,
    printerId,
    filename: texto(dados.filename),
    quando: numero(dados.quando, Date.now()),
    gramas,
  };
};

const sanitizarPerfil = (bruto: unknown): FilamentProfile | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const dados = bruto as Record<string, unknown>;
  const material = texto(dados.material).toUpperCase();
  if (!material) return null;
  return {
    material,
    tempBicoMin: numero(dados.tempBicoMin),
    tempBicoMax: numero(dados.tempBicoMax),
    tempMesa: numero(dados.tempMesa),
    notas: texto(dados.notas) || undefined,
  };
};

const sanitizarUso = (bruto: unknown): UsageRecord | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const dados = bruto as Record<string, unknown>;
  const id = texto(dados.id);
  const jobId = texto(dados.jobId);
  const spoolId = texto(dados.spoolId);
  if (!id || !jobId || !spoolId) return null;
  return {
    id,
    jobId,
    printerId: texto(dados.printerId),
    spoolId,
    gramas: Math.max(0, numero(dados.gramas)),
    custo: Math.max(0, numero(dados.custo)),
    quando: numero(dados.quando, Date.now()),
  };
};

const juntar = <T>(
  bruto: unknown,
  sanitizar: (item: unknown) => T | null
): T[] =>
  lista(bruto)
    .map(sanitizar)
    .filter((item): item is T => item !== null);

/**
 * Normaliza qualquer coisa parecida com um estado — v2, v1 (`rolos`) ou lixo —
 * para o esquema actual. Nunca lança: dados maus são descartados.
 */
export const migrarEstado = (bruto: unknown): EstadoFilamentos => {
  if (!bruto || typeof bruto !== 'object') return estadoVazio();
  const dados = bruto as Record<string, unknown>;
  // v1 chamava-lhes `rolos`; v2 chama-lhes `bobinas`.
  const bobinas = lista(dados.bobinas).length
    ? lista(dados.bobinas)
    : lista(dados.rolos);

  return {
    versao: VERSAO_ESQUEMA,
    bobinas: juntar(bobinas, sanitizarBobina),
    garrafas: juntar(lista(dados.garrafas), sanitizarGarrafa),
    pendentes: juntar(lista(dados.pendentes), sanitizarPendente),
    perfis: juntar(lista(dados.perfis), sanitizarPerfil),
    usos: juntar(lista(dados.usos), sanitizarUso),
  };
};

export const carregarEstado = async (): Promise<EstadoFilamentos> => {
  try {
    const guardado = await AsyncStorage.getItem(CHAVE);
    if (guardado) return migrarEstado(JSON.parse(guardado));
  } catch (erro) {
    log('filamentos: estado ilegível', erro);
  }

  try {
    const legado = await AsyncStorage.getItem(CHAVE_LEGADA);
    if (!legado) return estadoVazio();
    const migrado = migrarEstado(JSON.parse(legado));
    // Grava a versão nova mas deixa a antiga intacta (rollback seguro).
    await AsyncStorage.setItem(CHAVE, JSON.stringify(migrado));
    log('filamentos: migrado de v1', migrado.bobinas.length);
    return migrado;
  } catch (erro) {
    log('filamentos: migração falhou', erro);
    return estadoVazio();
  }
};

export const guardarEstado = async (
  estado: EstadoFilamentos
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      CHAVE,
      JSON.stringify({ ...estado, versao: VERSAO_ESQUEMA })
    );
  } catch (erro) {
    log('filamentos: não consegui gravar', erro);
  }
};
