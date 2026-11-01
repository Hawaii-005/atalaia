/**
 * Pesquisa das definições.
 *
 * A lista de definições é descrita por uma tabela de entradas (id, secção,
 * título e ajuda, já traduzidos). A pesquisa é uma função pura: normaliza
 * acentos e maiúsculas e exige que todos os termos apareçam no título, na
 * ajuda ou nas palavras-chave.

 * Não conhece React nem o i18n: recebe texto já traduzido.
 */

export type SecaoId =
  | 'impressoras'
  | 'aparencia'
  | 'fila'
  | 'filamentos'
  | 'dados'
  | 'sobre';

/** Ordem em que as secções aparecem no ecrã e no índice. */
export const ORDEM_SECOES: SecaoId[] = [
  'impressoras',
  'aparencia',
  'fila',
  'filamentos',
  'dados',
  'sobre',
];

export interface EntradaDefinicao {
  /** Identificador estável da opção (ex.: `aparencia.tema`). */
  id: string;
  secao: SecaoId;
  titulo: string;
  ajuda?: string;
  /** Sinónimos que não aparecem no ecrã mas ajudam a encontrar a opção. */
  palavras?: string[];
}

/** Minúsculas e sem diacríticos, para «Definições» casar com «definicoes». */
export const normalizar = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Divide a consulta em termos; ignora espaços a mais. */
export const termosDaConsulta = (consulta: string): string[] =>
  normalizar(consulta).split(/\s+/).filter(Boolean);

/**
 * Entradas que contêm todos os termos da consulta. Consulta vazia devolve
 * tudo (sem filtro).
 */
export const filtrarEntradas = (
  entradas: EntradaDefinicao[],
  consulta: string
): EntradaDefinicao[] => {
  const termos = termosDaConsulta(consulta);
  if (termos.length === 0) return entradas;

  return entradas.filter(entrada => {
    const alvo = normalizar(
      [entrada.titulo, entrada.ajuda ?? '', ...(entrada.palavras ?? [])].join(
        ' '
      )
    );
    return termos.every(termo => alvo.includes(termo));
  });
};

/** Ids visíveis com a consulta actual, para as secções filtrarem as linhas. */
export const idsVisiveis = (
  entradas: EntradaDefinicao[],
  consulta: string
): Set<string> => new Set(filtrarEntradas(entradas, consulta).map(e => e.id));

/** Secções que ainda têm pelo menos uma entrada visível. */
export const secoesVisiveis = (
  entradas: EntradaDefinicao[],
  consulta: string
): SecaoId[] => {
  const vistas = new Set(filtrarEntradas(entradas, consulta).map(e => e.secao));
  return ORDEM_SECOES.filter(secao => vistas.has(secao));
};

/** Entradas de uma secção, pela ordem em que foram declaradas. */
export const entradasDaSecao = (
  entradas: EntradaDefinicao[],
  secao: SecaoId
): EntradaDefinicao[] => entradas.filter(entrada => entrada.secao === secao);
