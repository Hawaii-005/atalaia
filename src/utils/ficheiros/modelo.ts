/**
 * Registo local de ficheiros: favorito, reimpressões, última impressão e
 * etiquetas.
 *
 * Tudo é local e funciona sem rede. A identidade de um ficheiro é
 * **impressora + caminho na impressora + tamanho**: o mesmo nome pode ser outro
 * ficheiro (versão nova), e um ficheiro copiado para outra impressora é outro
 * registo.
 *
 * Todas as operações devolvem um estado novo — nenhuma altera o argumento.
 */

export const VERSAO_REGISTO = 1;
export const MAX_ETIQUETAS = 8;
const MAX_ETIQUETA = 24;
/** Imprime às vezes o mesmo nome com barras diferentes; normaliza-se ao procurar. */
const normalizarNome = (nome: string) => nome.trim().toLowerCase();

const tamanhoValido = (valor?: number): number | undefined =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? Math.trunc(valor)
    : undefined;

export interface FicheiroAlvo {
  printerId: string;
  /** Caminho como a impressora o devolve (`/local/peça.gcode`). */
  nome: string;
  /** Bytes, quando conhecido. Distingue versões com o mesmo nome. */
  tamanho?: number;
}

export interface RegistoFicheiro {
  chave: string;
  printerId: string;
  nome: string;
  tamanho?: number;
  favorito: boolean;
  reimpressoes: number;
  /** ISO 8601 do último arranque contado. */
  ultimaImpressao?: string;
  etiquetas: string[];
  /** Id do último job contado — impede contar o mesmo arranque duas vezes. */
  ultimoJob?: string;
}

export interface EstadoFicheiros {
  versao: number;
  registos: RegistoFicheiro[];
}

export const estadoVazio = (): EstadoFicheiros => ({
  versao: VERSAO_REGISTO,
  registos: [],
});

/** Nome curto para mostrar (`/local/x.gcode` → `x.gcode`). */
export const nomeVisivel = (nome: string): string =>
  nome.split('/').pop() ?? nome;

/**
 * Chave estável. É fixada na primeira vez que o ficheiro é visto; procurar por
 * um tamanho que entretanto ficou conhecido devolve o registo antigo (ver
 * `procurarRegisto`), por isso a chave nunca muda de valor.
 */
export const chaveDe = (alvo: FicheiroAlvo): string =>
  `${alvo.printerId}|${normalizarNome(alvo.nome)}|${tamanhoValido(alvo.tamanho) ?? ''}`;

export const procurarRegisto = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo
): RegistoFicheiro | undefined => {
  const exacto = estado.registos.find(item => item.chave === chaveDe(alvo));
  if (exacto) return exacto;
  const nome = normalizarNome(alvo.nome);
  const tamanho = tamanhoValido(alvo.tamanho);
  return estado.registos.find(item => {
    if (item.printerId !== alvo.printerId) return false;
    if (normalizarNome(item.nome) !== nome) return false;
    // Um dos lados sem tamanho: é o mesmo ficheiro, só não sabíamos o peso.
    if (tamanho === undefined || item.tamanho === undefined) return true;
    return item.tamanho === tamanho;
  });
};

const criarRegisto = (alvo: FicheiroAlvo): RegistoFicheiro => ({
  chave: chaveDe(alvo),
  printerId: alvo.printerId,
  nome: alvo.nome,
  tamanho: tamanhoValido(alvo.tamanho),
  favorito: false,
  reimpressoes: 0,
  etiquetas: [],
});

const upsert = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo,
  mudanca: Partial<RegistoFicheiro>
): EstadoFicheiros => {
  const existente = procurarRegisto(estado, alvo);
  const base = existente ?? criarRegisto(alvo);
  const novo: RegistoFicheiro = {
    ...base,
    ...mudanca,
    // A chave e a identidade não são reescritas por engano.
    chave: base.chave,
    printerId: base.printerId,
    nome: base.nome,
    tamanho: base.tamanho ?? tamanhoValido(alvo.tamanho),
  };
  const registos = existente
    ? estado.registos.map(item =>
        item.chave === existente.chave ? novo : item
      )
    : [...estado.registos, novo];
  return { ...estado, registos };
};

export const marcarFavorito = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo,
  favorito: boolean
): EstadoFicheiros => upsert(estado, alvo, { favorito });

export const alternarFavorito = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo
): EstadoFicheiros =>
  marcarFavorito(estado, alvo, !procurarRegisto(estado, alvo)?.favorito);

/**
 * Conta um arranque de impressão **uma única vez por job**.
 *
 * `jobId` é o Id do comando que a impressora aceitou (o mesmo que vai no
 * envelope SDCP). Repetir o mesmo id — por duplo toque, por re-render ou por
 * recuperação depois de um erro de rede — não soma outra reimpressão.
 * Sem `jobId` não se conta nada: um contador errado é pior do que um contador
 * que fica atrás.
 */
export const registarArranque = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo,
  opcoes: { jobId: string; quando?: string }
): EstadoFicheiros => {
  const jobId = String(opcoes.jobId ?? '').trim();
  if (!jobId) return estado;
  const existente = procurarRegisto(estado, alvo);
  if (existente?.ultimoJob === jobId) return estado;
  return upsert(estado, alvo, {
    reimpressoes: (existente?.reimpressoes ?? 0) + 1,
    ultimaImpressao: opcoes.quando ?? new Date().toISOString(),
    ultimoJob: jobId,
  });
};

export const definirEtiquetas = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo,
  etiquetas: readonly string[]
): EstadoFicheiros => {
  const limpas: string[] = [];
  const vistos = new Set<string>();
  for (const bruta of etiquetas ?? []) {
    const etiqueta = String(bruta).trim().slice(0, MAX_ETIQUETA);
    const chave = etiqueta.toLowerCase();
    if (!etiqueta || vistos.has(chave)) continue;
    vistos.add(chave);
    limpas.push(etiqueta);
    if (limpas.length >= MAX_ETIQUETAS) break;
  }
  return upsert(estado, alvo, { etiquetas: limpas });
};

/**
 * Esquece ficheiros que já não existem na impressora.
 *
 * `existentes` traz, por impressora, os nomes que a listagem devolveu agora.
 * Uma impressora que não aparece no mapa (desligada, sem resposta) mantém os
 * registos: não saber não é o mesmo que ter desaparecido.
 */
export const podarRegistos = (
  estado: EstadoFicheiros,
  existentes: Record<string, readonly string[] | Set<string>>
): EstadoFicheiros => {
  const mapa = new Map<string, Set<string>>();
  Object.entries(existentes ?? {}).forEach(([printerId, nomes]) => {
    const conjunto = new Set<string>();
    Array.from(nomes ?? []).forEach(nome => conjunto.add(normalizarNome(nome)));
    mapa.set(printerId, conjunto);
  });

  const registos = estado.registos.filter(registo => {
    const lista = mapa.get(registo.printerId);
    if (!lista) return true;
    return lista.has(normalizarNome(registo.nome));
  });

  if (registos.length === estado.registos.length) return estado;
  return { ...estado, registos };
};

/** O que o ecrã mostra de um ficheiro, com valores por omissão. */
export const resumoDoRegisto = (
  estado: EstadoFicheiros,
  alvo: FicheiroAlvo
): {
  favorito: boolean;
  reimpressoes: number;
  ultimaImpressao?: string;
  etiquetas: string[];
} => {
  const registo = procurarRegisto(estado, alvo);
  return {
    favorito: registo?.favorito ?? false,
    reimpressoes: registo?.reimpressoes ?? 0,
    ultimaImpressao: registo?.ultimaImpressao,
    etiquetas: registo?.etiquetas ?? [],
  };
};

/** Nomes dos registos favoritos de uma impressora (filtro da lista). */
export const favoritosDe = (
  estado: EstadoFicheiros,
  printerId: string
): string[] =>
  estado.registos
    .filter(registo => registo.printerId === printerId && registo.favorito)
    .map(registo => registo.nome);
