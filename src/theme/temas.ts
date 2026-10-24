/**
 * Temas da app — ponte entre os tokens v6 (`tokensV6.ts`, cores em hex) e a
 * forma antiga que o resto da app ainda usa (cores em "r g b" para o NativeWind).
 *
 * A fonte única é `tokensV6.ts`. Aqui só se traduzem os nomes antigos
 * (`tinta`, `acento`, `linha`, …) para os novos (`texto`, `primaria`, `contorno`, …)
 * e se converte hex → "r g b". Nenhum ecrã novo deve usar os nomes antigos.
 */

import {
  temas as paletas,
  temaPredefinido,
  nomesDosTemas,
  type NomeTema,
  type Paleta as PaletaV6,
} from './tokensV6';

export type TemaId = NomeTema;

export type Paleta = {
  fundo: string;
  fundoBaixo: string;
  cartao: string;
  tinta: string;
  tintaSoft: string;
  tintaMuted: string;
  linha: string;
  acento: string;
  acentoForte: string;
  acentoSuave: string;
  /** acento legível como texto (mais claro nos temas escuros) */
  acentoTexto: string;
  /** tinta escura fixa, para fundos claros (ex.: aviso âmbar) */
  tintaFixa: string;
  ok: string;
  aviso: string;
  perigo: string;
};

export type Tema = {
  id: TemaId;
  nome: string;
  descricao: string;
  escuro: boolean;
  /** cores de amostra para o selector */
  amostra: [string, string, string];
  paleta: Paleta;
};

/** "#1E1B33" → "30 27 51" */
const triplo = (hex: string): string => {
  const limpo = hex.replace('#', '').trim();
  const cheio = limpo.length === 3 ? limpo.replace(/./g, c => c + c) : limpo;
  const n = parseInt(cheio, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
};

const TINTA_FIXA = '23 26 32';

const traduzir = (p: PaletaV6): Paleta => ({
  fundo: triplo(p.fundo),
  fundoBaixo: triplo(p.cartaoAlt),
  cartao: triplo(p.cartao),
  tinta: triplo(p.texto),
  tintaSoft: triplo(p.textoSecundario),
  tintaMuted: triplo(p.textoSecundario),
  linha: triplo(p.contorno),
  acento: triplo(p.primaria),
  acentoForte: triplo(p.primaria),
  acentoSuave: triplo(p.pilulaNav),
  acentoTexto: triplo(p.primaria),
  tintaFixa: TINTA_FIXA,
  ok: triplo(p.sucesso),
  aviso: triplo(p.aviso),
  perigo: triplo(p.perigo),
});

const DESCRICOES: Record<TemaId, string> = {
  conceito: 'Roxo escuro do conceito aprovado.',
  grafite: 'Escuro neutro. Azul apenas no que se pode tocar.',
  nord: 'Cinza-azulado do Norte, calmo.',
  papel: 'Claro e quente, como papel.',
};

const construir = (id: TemaId): Tema => {
  const paleta = paletas[id];
  return {
    id,
    nome: nomesDosTemas[id],
    descricao: DESCRICOES[id],
    escuro: paleta.modo === 'escuro',
    amostra: [paleta.cartao, paleta.primaria, paleta.fundo],
    paleta: traduzir(paleta),
  };
};

export const TEMAS: Record<TemaId, Tema> = {
  conceito: construir('conceito'),
  grafite: construir('grafite'),
  nord: construir('nord'),
  papel: construir('papel'),
};

export const ORDEM_TEMAS: TemaId[] = ['conceito', 'grafite', 'papel', 'nord'];
export const TEMA_PREDEFINIDO: TemaId = temaPredefinido;

/** "18 16 34" → "#121022" (para sítios que não aceitam variáveis) */
export function hexDe(triploDeCores: string): string {
  const [r, g, b] = triploDeCores.split(' ').map(v => parseInt(v, 10) || 0);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Objecto de variáveis CSS para o `vars()` do NativeWind. */
export function variaveis(tema: Tema): Record<string, string> {
  const p = tema.paleta;
  return {
    '--fundo': p.fundo,
    '--fundo-baixo': p.fundoBaixo,
    '--cartao': p.cartao,
    '--tinta': p.tinta,
    '--tinta-soft': p.tintaSoft,
    '--tinta-muted': p.tintaMuted,
    '--linha': p.linha,
    '--acento': p.acento,
    '--acento-forte': p.acentoForte,
    '--acento-suave': p.acentoSuave,
    '--acento-texto': p.acentoTexto,
    '--tinta-fixa': p.tintaFixa,
    '--ok': p.ok,
    '--aviso': p.aviso,
    '--perigo': p.perigo,
  };
}
