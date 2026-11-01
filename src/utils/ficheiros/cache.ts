/**
 * Última lista de ficheiros que a impressora devolveu.
 *
 * Serve só para o estado «sem ligação»: mostra-se o que havia, com a hora, em
 * vez de um ecrã vazio. É cache de leitura — nunca se apaga a lista real por
 * causa disto, e não vai para a cópia de segurança (é reproduzível).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../log';
import { FicheiroLista } from './lista';

export const CHAVE_CACHE = 'atalaia.ficheiros.cache.v1';
/** Passado este tempo a lista ainda aparece, mas com aviso de antiga. */
export const IDADE_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheGuardada {
  versao: 1;
  impressoraId: string;
  guardadoEm: string;
  ficheiros: FicheiroLista[];
}

export interface CacheLista {
  ficheiros: FicheiroLista[];
  guardadoEm: string;
  /** Há quanto tempo foi guardada, em ms. */
  idadeMs: number;
  antiga: boolean;
}

const numeroOuIndefinido = (valor: unknown): number | undefined =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? valor
    : undefined;

const lerFicheiro = (bruto: unknown): FicheiroLista | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const item = bruto as Record<string, unknown>;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return null;
  return {
    name,
    FileSize: numeroOuIndefinido(item.FileSize),
    usedSize: numeroOuIndefinido(item.usedSize),
    totalSize: numeroOuIndefinido(item.totalSize),
    CreateTime: numeroOuIndefinido(item.CreateTime),
    TotalLayers: numeroOuIndefinido(item.TotalLayers),
  };
};

export const lerCacheGuardada = (bruto: unknown): CacheGuardada | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const cache = bruto as Record<string, unknown>;
  if (typeof cache.impressoraId !== 'string' || !cache.impressoraId)
    return null;
  if (typeof cache.guardadoEm !== 'string' || !cache.guardadoEm) return null;
  if (!Array.isArray(cache.ficheiros)) return null;
  const ficheiros: FicheiroLista[] = [];
  const vistos = new Set<string>();
  for (const item of cache.ficheiros) {
    const ficheiro = lerFicheiro(item);
    if (!ficheiro || vistos.has(ficheiro.name)) continue;
    vistos.add(ficheiro.name);
    ficheiros.push(ficheiro);
  }
  return {
    versao: 1,
    impressoraId: cache.impressoraId,
    guardadoEm: cache.guardadoEm,
    ficheiros,
  };
};

export const guardarCache = async (
  impressoraId: string,
  ficheiros: readonly FicheiroLista[],
  agora: Date = new Date()
): Promise<void> => {
  try {
    const dados: CacheGuardada = {
      versao: 1,
      impressoraId,
      guardadoEm: agora.toISOString(),
      ficheiros: ficheiros.map(item => ({
        name: item.name,
        FileSize: item.FileSize,
        usedSize: item.usedSize,
        totalSize: item.totalSize,
        CreateTime: item.CreateTime,
        TotalLayers: item.TotalLayers,
      })),
    };
    await AsyncStorage.setItem(CHAVE_CACHE, JSON.stringify(dados));
  } catch (erro) {
    log('ficheiros: não consegui guardar a cópia da lista', erro);
  }
};

export const carregarCache = async (
  impressoraId: string,
  agora: Date = new Date()
): Promise<CacheLista | null> => {
  try {
    const cru = await AsyncStorage.getItem(CHAVE_CACHE);
    if (!cru) return null;
    const dados = lerCacheGuardada(JSON.parse(cru));
    if (!dados || dados.impressoraId !== impressoraId) return null;
    const guardado = new Date(dados.guardadoEm).getTime();
    const idadeMs = Number.isFinite(guardado)
      ? Math.max(0, agora.getTime() - guardado)
      : Number.POSITIVE_INFINITY;
    if (idadeMs > IDADE_MAXIMA_MS) return null;
    return {
      ficheiros: dados.ficheiros,
      guardadoEm: dados.guardadoEm,
      idadeMs,
      antiga: idadeMs > 60 * 60 * 1000,
    };
  } catch (erro) {
    log('ficheiros: não consegui ler a cópia da lista', erro);
    return null;
  }
};

export const apagarCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CHAVE_CACHE);
  } catch {
    // sem consequências
  }
};

/**
 * Idade em partes, para o i18n compor a frase («há {n} min»).
 * Devolve `null` quando é agora mesmo.
 */
export const idadeEmPartes = (
  idadeMs: number
): { unidade: 'min' | 'h' | 'dia'; valor: number } | null => {
  if (!Number.isFinite(idadeMs)) return null;
  const minutos = Math.floor(idadeMs / 60000);
  if (minutos < 1) return null;
  if (minutos < 60) return { unidade: 'min', valor: minutos };
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return { unidade: 'h', valor: horas };
  return { unidade: 'dia', valor: Math.floor(horas / 24) };
};
