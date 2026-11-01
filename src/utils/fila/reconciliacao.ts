/**
 * Reconciliação com o estado real da impressora.
 *
 * A app não tem serviços em segundo plano: quando é fechada a meio de um
 * envio, fica sem saber o que aconteceu. Em vez de adivinhar (e de reenviar o
 * mesmo trabalho), guarda o que mandou e compara-o com o que a máquina diz
 * quando volta a falar.
 */
import { ItemFila } from './modelo';

export interface EstadoReal {
  ligada: boolean;
  /** Ficheiro que a impressora diz estar a imprimir; vazio quando está livre. */
  aImprimir?: string;
  /** Código SDCP: 9 = terminada, 7/8 = parada, 5/6/13 = a imprimir. */
  estado?: number;
}

export interface CursoGravado {
  printerId: string;
  itemId: string;
  name: string;
  startedAt: number;
  comandoId?: string;
}

export const ESTADO_TERMINADA = 9;
export const ESTADOS_A_IMPRIMIR = [5, 6, 13];

/** Só o nome interessa: caminhos diferentes para o mesmo ficheiro são iguais. */
export const mesmoTrabalho = (a?: string, b?: string): boolean => {
  const limpar = (nome?: string) =>
    (nome ?? '').split('/').pop()!.trim().toLowerCase();
  if (!a || !b) return false;
  return limpar(a) === limpar(b);
};

const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor.length > 0 ? valor : undefined;

export const lerCurso = (cru: unknown): CursoGravado | null => {
  if (!cru || typeof cru !== 'object') return null;
  const c = cru as Record<string, unknown>;
  const printerId = texto(c.printerId);
  const itemId = texto(c.itemId);
  const name = texto(c.name);
  if (!printerId || !itemId || !name) return null;
  return {
    printerId,
    itemId,
    name,
    startedAt: typeof c.startedAt === 'number' ? c.startedAt : 0,
    ...(texto(c.comandoId) ? { comandoId: texto(c.comandoId) } : {}),
  };
};

export const lerCursos = (cru: unknown): Record<string, CursoGravado> => {
  if (!cru || typeof cru !== 'object') return {};
  const mapa: Record<string, CursoGravado> = {};
  Object.values(cru as Record<string, unknown>).forEach(valor => {
    const curso = lerCurso(valor);
    if (curso) mapa[curso.printerId] = curso;
  });
  return mapa;
};

export type ResultadoCurso = 'aCorrer' | 'terminou' | 'desconhecido';

/**
 * O que aconteceu ao trabalho que a fila arrancou?
 *
 * Sem ligação, ou com a máquina ligada mas sem estado conhecido, devolve
 * `desconhecido` — nesse caso nada é decidido.
 */
export const estadoDoCurso = (
  curso: CursoGravado,
  real: EstadoReal
): ResultadoCurso => {
  if (!real.ligada) return 'desconhecido';
  if (mesmoTrabalho(real.aImprimir, curso.name)) return 'aCorrer';
  if (real.estado === ESTADO_TERMINADA) return 'terminou';
  if (real.aImprimir) return 'terminou';
  return 'desconhecido';
};

/**
 * Resolve um item bloqueado por envio interrompido:
 *
 * - a máquina está a imprimir o nosso ficheiro → está a imprimir (não repetir);
 * - a máquina está livre (9, 7 ou 8) e não é o nosso ficheiro → volta a
 *   pendente, com segurança para tentar outra vez;
 * - qualquer outro caso → fica como está.
 */
export const reconciliarItem = (
  item: ItemFila,
  real: EstadoReal,
  agora: number
): ItemFila => {
  if (item.estado !== 'bloqueado' || item.motivo !== 'envioInterrompido') {
    return item;
  }
  if (!real.ligada) return item;
  if (mesmoTrabalho(real.aImprimir, item.name)) {
    return {
      ...item,
      estado: 'aImprimir',
      motivo: undefined,
      atualizadoEm: agora,
    };
  }
  const livre =
    real.estado === ESTADO_TERMINADA ||
    real.estado === 7 ||
    real.estado === 8 ||
    real.estado === 0;
  if (livre && !real.aImprimir) {
    return {
      ...item,
      estado: 'pendente',
      motivo: undefined,
      atualizadoEm: agora,
    };
  }
  return item;
};

export const reconciliarFila = (
  itens: ItemFila[],
  real: EstadoReal,
  agora: number
): ItemFila[] => itens.map(item => reconciliarItem(item, real, agora));
