/**
 * Temas da app — cada tema é só um conjunto de tokens (cores em "r g b",
 * para funcionarem com rgb(var(--x) / <alpha-value>) no Tailwind).
 *
 * Estrutura e layout são os mesmos em todos: muda a pele, não a app.
 */

export type TemaId = 'grafite' | 'vidro' | 'nord' | 'papel';

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

export const TEMAS: Record<TemaId, Tema> = {
  // B — Grafite: claro neutro, azul só no activo
  grafite: {
    id: 'grafite',
    nome: 'Grafite',
    descricao: 'Claro e neutro. Azul apenas no que se pode tocar.',
    escuro: false,
    amostra: ['#FFFFFF', '#3E6AE1', '#171A20'],
    paleta: {
      fundo: '255 255 255',
      fundoBaixo: '244 244 244',
      cartao: '255 255 255',
      tinta: '23 26 32',
      tintaSoft: '63 68 77',
      tintaMuted: '99 103 110',
      linha: '228 228 228',
      acento: '62 106 225',
      acentoForte: '47 85 196',
      acentoSuave: '237 241 252',
      ok: '31 157 85',
      aviso: '242 169 0',
      perigo: '198 40 40',
    },
  },

  // D — Vidro: escuro com violeta e ciano
  vidro: {
    id: 'vidro',
    nome: 'Vidro',
    descricao: 'Escuro profundo com violeta vivo e ciano de estado.',
    escuro: true,
    amostra: ['#121022', '#8B5CF6', '#7DF9FF'],
    paleta: {
      fundo: '18 16 34',
      fundoBaixo: '30 26 52',
      cartao: '30 27 50',
      tinta: '242 245 255',
      tintaSoft: '205 200 232',
      tintaMuted: '158 152 190',
      linha: '62 58 92',
      acento: '139 92 246',
      acentoForte: '109 62 214',
      acentoSuave: '48 40 74',
      ok: '143 191 106',
      aviso: '238 212 159',
      perigo: '255 100 120',
    },
  },

  // J — Nord: escuro frio, azul-acinzentado
  nord: {
    id: 'nord',
    nome: 'Nord',
    descricao: 'Frio e calmo. Azul gelado, verde e coral nos estados.',
    escuro: true,
    amostra: ['#2E3440', '#5E81AC', '#88C0D0'],
    paleta: {
      fundo: '46 52 64',
      fundoBaixo: '59 66 82',
      cartao: '59 66 82',
      tinta: '236 239 244',
      tintaSoft: '216 222 233',
      tintaMuted: '163 172 187',
      linha: '76 86 106',
      acento: '94 129 172',
      acentoForte: '76 110 150',
      acentoSuave: '67 76 94',
      ok: '163 190 140',
      aviso: '235 203 139',
      perigo: '191 97 106',
    },
  },

  // L — Papel: claro quente, azul de impressão
  papel: {
    id: 'papel',
    nome: 'Papel',
    descricao: 'Claro quente, tipo folha de projecto. Azul forte na acção.',
    escuro: false,
    amostra: ['#F6F4EF', '#2F6BFF', '#171A20'],
    paleta: {
      fundo: '246 244 239',
      fundoBaixo: '237 233 225',
      cartao: '255 253 249',
      tinta: '23 26 32',
      tintaSoft: '60 65 72',
      tintaMuted: '108 111 119',
      linha: '226 222 213',
      acento: '47 107 255',
      acentoForte: '34 84 214',
      acentoSuave: '232 236 250',
      ok: '47 125 85',
      aviso: '214 138 40',
      perigo: '195 64 44',
    },
  },
};

export const ORDEM_TEMAS: TemaId[] = ['grafite', 'papel', 'vidro', 'nord'];
export const TEMA_PREDEFINIDO: TemaId = 'grafite';

/** "18 16 34" → "#121022" (para sítios que não aceitam variáveis) */
export function hexDe(triplo: string): string {
  const [r, g, b] = triplo.split(' ').map(v => parseInt(v, 10) || 0);
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
    '--ok': p.ok,
    '--aviso': p.aviso,
    '--perigo': p.perigo,
  };
}
