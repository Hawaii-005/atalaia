/**
 * Pesquisa, filtros e ordenação da lista de ficheiros.
 *
 * Tudo puro e testável: o ecrã só chama `aplicarFiltros` e desenha o resultado.
 */

import { duracaoDoNome } from '../duracao';

export type OrdemLista = 'nome' | 'data' | 'tamanho' | 'duracao';

export interface FicheiroLista {
  name: string;
  FileSize?: number;
  usedSize?: number;
  totalSize?: number;
  CreateTime?: number;
  TotalLayers?: number;
}

export interface FiltrosLista {
  texto: string;
  ordem: OrdemLista;
  crescente: boolean;
  apenasFavoritos?: boolean;
}

/** `1h 12m` → forma curta para a linha; o ficheiro manda no tamanho. */
export const tamanhoDoFicheiro = (ficheiro: FicheiroLista): number =>
  ficheiro.FileSize ?? ficheiro.totalSize ?? ficheiro.usedSize ?? 0;

export const nomeCurto = (nome: string): string =>
  nome.split('/').pop() ?? nome;

/**
 * Minúsculas e sem acentos: «peça» encontra «peca» e «PEÇA».
 * O teclado do telemóvel raramente põe o acento certo; a pesquisa não deve
 * castigar isso.
 */
export const normalizarTexto = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const filtrarFicheiros = <T extends FicheiroLista>(
  ficheiros: readonly T[],
  filtros: FiltrosLista,
  ehFavorito?: (nome: string) => boolean
): T[] => {
  const termo = normalizarTexto(filtros.texto);
  return ficheiros.filter(ficheiro => {
    if (filtros.apenasFavoritos && !(ehFavorito?.(ficheiro.name) ?? false)) {
      return false;
    }
    if (!termo) return true;
    return normalizarTexto(nomeCurto(ficheiro.name)).includes(termo);
  });
};

export const ordenarFicheiros = <T extends FicheiroLista>(
  ficheiros: readonly T[],
  ordem: OrdemLista,
  crescente: boolean
): T[] => {
  const copia = [...ficheiros];

  // Sem duração conhecida fica sempre no fim, cresça ou decresça.
  if (ordem === 'duracao') {
    copia.sort((a, b) => {
      const da = duracaoDoNome(a.name);
      const db = duracaoDoNome(b.name);
      if (!da && !db) return a.name.localeCompare(b.name);
      if (!da) return 1;
      if (!db) return -1;
      if (da === db) return a.name.localeCompare(b.name);
      return crescente ? da - db : db - da;
    });
    return copia;
  }

  copia.sort((a, b) => {
    if (ordem === 'data') {
      const diferenca = (a.CreateTime ?? 0) - (b.CreateTime ?? 0);
      return diferenca || a.name.localeCompare(b.name);
    }
    if (ordem === 'tamanho') {
      const diferenca = tamanhoDoFicheiro(a) - tamanhoDoFicheiro(b);
      return diferenca || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  return crescente ? copia : copia.reverse();
};

export const aplicarFiltros = <T extends FicheiroLista>(
  ficheiros: readonly T[],
  filtros: FiltrosLista,
  ehFavorito?: (nome: string) => boolean
): T[] =>
  ordenarFicheiros(
    filtrarFicheiros(ficheiros, filtros, ehFavorito),
    filtros.ordem,
    filtros.crescente
  );

/** Quantos ficheiros da lista estão marcados como favoritos. */
export const contarFavoritos = (
  ficheiros: readonly FicheiroLista[],
  ehFavorito: (nome: string) => boolean
): number => ficheiros.filter(ficheiro => ehFavorito(ficheiro.name)).length;

/**
 * Texto do resumo por baixo da lista (bloco 5 do wireframe).
 * `total` é o que a impressora devolveu; `visiveis` o que passou pelos filtros.
 */
export const descreverResumo = (
  visiveis: readonly FicheiroLista[],
  total: number,
  ordem: OrdemLista
): {
  ficheiros: number;
  bytes: number;
  filtrado: boolean;
  ordem: OrdemLista;
} => ({
  ficheiros: visiveis.length,
  bytes: visiveis.reduce((soma, item) => soma + tamanhoDoFicheiro(item), 0),
  filtrado: visiveis.length !== total,
  ordem,
});
