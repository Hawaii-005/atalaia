/**
 * Armazenamento local do registo de ficheiros, com versão de esquema.
 *
 * Segue o mesmo desenho do inventário de filamentos: uma chave nova, uma
 * leitura defensiva (nada de rebentar por causa de um backup estragado) e uma
 * migração explícita. Não há chave legada: isto nasce agora na versão 1.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../log';
import {
  EstadoFicheiros,
  FicheiroAlvo,
  RegistoFicheiro,
  VERSAO_REGISTO,
  alternarFavorito,
  definirEtiquetas,
  marcarFavorito,
  estadoVazio,
  registarArranque,
} from './modelo';

export const CHAVE = 'atalaia.ficheiros.v1';
export const VERSAO_ESQUEMA = VERSAO_REGISTO;

const texto = (valor: unknown, defeito = ''): string =>
  typeof valor === 'string' ? valor : defeito;

const numero = (valor: unknown): number | undefined =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? Math.trunc(valor)
    : undefined;

const booleano = (valor: unknown): boolean => valor === true;

const listaDeTexto = (valor: unknown): string[] =>
  Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === 'string')
    : [];

/** Aceita um registo vindo do disco ou de um backup, ou devolve null. */
export const lerRegisto = (bruto: unknown): RegistoFicheiro | null => {
  if (!bruto || typeof bruto !== 'object') return null;
  const registo = bruto as Record<string, unknown>;
  const printerId = texto(registo.printerId).trim();
  const nome = texto(registo.nome).trim();
  if (!printerId || !nome) return null;
  const tamanho = numero(registo.tamanho);
  return {
    chave:
      texto(registo.chave).trim() ||
      `${printerId}|${nome.toLowerCase()}|${tamanho ?? ''}`,
    printerId,
    nome,
    tamanho,
    favorito: booleano(registo.favorito),
    reimpressoes: Math.max(0, numero(registo.reimpressoes) ?? 0),
    ultimaImpressao: texto(registo.ultimaImpressao) || undefined,
    etiquetas: listaDeTexto(registo.etiquetas).slice(0, 8),
    ultimoJob: texto(registo.ultimoJob) || undefined,
  };
};

/** Lê uma lista de registos, descartando o que não serve e chaves repetidas. */
export const lerRegistos = (bruto: unknown): RegistoFicheiro[] => {
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const registos: RegistoFicheiro[] = [];
  for (const item of bruto) {
    const registo = lerRegisto(item);
    if (!registo || vistos.has(registo.chave)) continue;
    vistos.add(registo.chave);
    registos.push(registo);
  }
  return registos;
};

export const migrarEstado = (bruto: unknown): EstadoFicheiros => {
  if (!bruto || typeof bruto !== 'object') return estadoVazio();
  const estado = bruto as Record<string, unknown>;
  // Versões futuras: lê-se o que se conhece e mantém-se o resto de fora.
  const registos = Array.isArray(estado.registos)
    ? lerRegistos(estado.registos)
    : Array.isArray(estado.ficheiros)
      ? lerRegistos(estado.ficheiros)
      : [];
  return { versao: VERSAO_ESQUEMA, registos };
};

export const carregarFicheiros = async (): Promise<EstadoFicheiros> => {
  try {
    const cru = await AsyncStorage.getItem(CHAVE);
    if (!cru) return estadoVazio();
    return migrarEstado(JSON.parse(cru));
  } catch (erro) {
    log('ficheiros: não consegui ler o registo', erro);
    return estadoVazio();
  }
};

export const gravarFicheiros = async (
  estado: EstadoFicheiros
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      CHAVE,
      JSON.stringify({ versao: VERSAO_ESQUEMA, registos: estado.registos })
    );
  } catch (erro) {
    log('ficheiros: não consegui gravar o registo', erro);
  }
};

/**
 * Lê, aplica uma operação pura e grava. Devolve o estado final para quem quiser
 * usá-lo já (a lista não precisa de esperar pela próxima leitura).
 *
 * Serializa as escritas de uma sessão: duas operações seguidas (favorito e
 * etiqueta, por exemplo) não se atropelam.
 */
let filaDeEscrita: Promise<EstadoFicheiros> = Promise.resolve(estadoVazio());

const aplicar = (
  operacao: (estado: EstadoFicheiros) => EstadoFicheiros
): Promise<EstadoFicheiros> => {
  const passo = filaDeEscrita
    .then(carregarFicheiros)
    .then(estado => {
      const novo = operacao(estado);
      return gravarFicheiros(novo).then(() => novo);
    })
    .catch(erro => {
      log('ficheiros: operação falhou', erro);
      return estadoVazio();
    });
  filaDeEscrita = passo;
  return passo;
};

export const guardarFavorito = (
  alvo: FicheiroAlvo,
  favorito: boolean
): Promise<EstadoFicheiros> =>
  aplicar(estado => marcarFavorito(estado, alvo, favorito));

export const guardarAlternarFavorito = (
  alvo: FicheiroAlvo
): Promise<EstadoFicheiros> =>
  aplicar(estado => alternarFavorito(estado, alvo));

export const guardarArranque = (
  alvo: FicheiroAlvo,
  jobId: string,
  quando?: string
): Promise<EstadoFicheiros> =>
  aplicar(estado => registarArranque(estado, alvo, { jobId, quando }));

export const guardarEtiquetas = (
  alvo: FicheiroAlvo,
  etiquetas: readonly string[]
): Promise<EstadoFicheiros> =>
  aplicar(estado => definirEtiquetas(estado, alvo, etiquetas));
