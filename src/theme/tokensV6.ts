/**
 * Ataláia — tokens de design (v6)
 * Valores em dp, para um ecrã de referência de 412 × 915.
 * Regra: nenhum ecrã ou componente usa cor ou número solto; tudo vem daqui.
 */

// ───────────────────────── Paleta ─────────────────────────

export type NomeTema = 'conceito' | 'grafite' | 'vidro' | 'nord' | 'papel';

export interface Paleta {
  modo: 'escuro' | 'claro';
  // Superfícies
  fundo: string; //            fundo do ecrã
  cartao: string; //           cartões (r20)
  cartaoAlt: string; //        elementos dentro de cartões (campos, botões secundários, chips inactivos)
  trilha: string; //           trilhos de slider/progresso, anel vazio, contornos fracos
  contorno: string; //         linhas e contornos de botões secundários
  barraNav: string; //         barra inferior
  pilulaNav: string; //        pílula do item activo na barra
  // Texto
  texto: string;
  textoSecundario: string;
  // Acção principal
  primaria: string;
  textoSobrePrimaria: string;
  // Estados
  sucesso: string;
  sucessoFundo: string; //     fundo de pílulas «Imprimindo», «Em uso»
  aviso: string;
  avisoFundo: string;
  perigo: string;
  perigoFundo: string; //      fundo de pílulas «AO VIVO», erros
  textoSobrePerigo: string;
  // Dados de impressão (temperaturas)
  bico: string;
  mesa: string;
  camara: string;
  // Câmara e sobreposições
  sobreposicao: string; //     escurecimento por trás de diálogos
  cameraTopo: string; //       gradiente de substituição quando não há imagem
  cameraBase: string;
}

/** Tema do conceito aprovado (roxo escuro). É o predefinido. */
const conceito: Paleta = {
  modo: 'escuro',
  fundo: '#141226',
  cartao: '#1E1B33',
  cartaoAlt: '#2A2646',
  trilha: '#3A3560',
  contorno: '#3A3560',
  barraNav: '#1B1830',
  pilulaNav: '#3F3270',
  texto: '#FFFFFF',
  textoSecundario: '#A29DB8',
  primaria: '#8B5CF6',
  textoSobrePrimaria: '#FFFFFF',
  sucesso: '#4ADE80',
  sucessoFundo: '#1F3A33',
  aviso: '#FBBF24',
  avisoFundo: '#422006',
  perigo: '#F87171',
  perigoFundo: '#3B1F2B',
  textoSobrePerigo: '#2B0B0B',
  bico: '#FBBF24',
  mesa: '#8B5CF6',
  camara: '#4ADE80',
  sobreposicao: 'rgba(0,0,0,0.62)',
  cameraTopo: '#2B2B33',
  cameraBase: '#6B5E50',
};

const grafite: Paleta = {
  modo: 'escuro',
  fundo: '#0F1115',
  cartao: '#1A1D23',
  cartaoAlt: '#242830',
  trilha: '#343945',
  contorno: '#343945',
  barraNav: '#14171C',
  pilulaNav: '#2B3140',
  texto: '#F2F4F7',
  textoSecundario: '#8B93A1',
  primaria: '#3B82F6',
  textoSobrePrimaria: '#FFFFFF',
  sucesso: '#22C55E',
  sucessoFundo: '#12301E',
  aviso: '#FBBF24',
  avisoFundo: '#3A2A08',
  perigo: '#EF4444',
  perigoFundo: '#3A1717',
  textoSobrePerigo: '#1F0A0A',
  bico: '#FB923C',
  mesa: '#A78BFA',
  camara: '#22D3EE',
  sobreposicao: 'rgba(0,0,0,0.62)',
  cameraTopo: '#22252B',
  cameraBase: '#5A5148',
};

const vidro: Paleta = {
  modo: 'escuro',
  fundo: '#14112B',
  cartao: '#1F1A3F',
  cartaoAlt: '#2B2556',
  trilha: '#3B3470',
  contorno: '#3B3470',
  barraNav: '#1A1638',
  pilulaNav: '#3A2F6B',
  texto: '#F2F5FF',
  textoSecundario: '#A8A6C8',
  primaria: '#C77DFF',
  textoSobrePrimaria: '#1A0B2E',
  sucesso: '#5CF2A6',
  sucessoFundo: '#16362F',
  aviso: '#FFD166',
  avisoFundo: '#41300F',
  perigo: '#FF2D55',
  perigoFundo: '#3F1530',
  textoSobrePerigo: '#2B0010',
  bico: '#FFD166',
  mesa: '#C77DFF',
  camara: '#7DF9FF',
  sobreposicao: 'rgba(8,6,24,0.66)',
  cameraTopo: '#251F45',
  cameraBase: '#5C5470',
};

const nord: Paleta = {
  modo: 'escuro',
  fundo: '#2E3440',
  cartao: '#3B4252',
  cartaoAlt: '#434C5E',
  trilha: '#4C566A',
  contorno: '#4C566A',
  barraNav: '#272C36',
  pilulaNav: '#4C566A',
  texto: '#ECEFF4',
  textoSecundario: '#A3ABBA',
  primaria: '#88C0D0',
  textoSobrePrimaria: '#2E3440',
  sucesso: '#A3BE8C',
  sucessoFundo: '#33403A',
  aviso: '#EBCB8B',
  avisoFundo: '#4A4231',
  perigo: '#BF616A',
  perigoFundo: '#4A3036',
  textoSobrePerigo: '#ECEFF4',
  bico: '#D08770',
  mesa: '#B48EAD',
  camara: '#8FBCBB',
  sobreposicao: 'rgba(20,24,32,0.64)',
  cameraTopo: '#3B4252',
  cameraBase: '#6B6A63',
};

const papel: Paleta = {
  modo: 'claro',
  fundo: '#F3EFE6',
  cartao: '#FFFFFF',
  cartaoAlt: '#ECE7DA',
  trilha: '#D9D3C3',
  contorno: '#D9D3C3',
  barraNav: '#FFFFFF',
  pilulaNav: '#E5DCFA',
  texto: '#1D1B26',
  textoSecundario: '#6B6677',
  primaria: '#6D3FD6',
  textoSobrePrimaria: '#FFFFFF',
  sucesso: '#15803D',
  sucessoFundo: '#DDF3E4',
  aviso: '#B45309',
  avisoFundo: '#FDEBC8',
  perigo: '#C62828',
  perigoFundo: '#FBE0E0',
  textoSobrePerigo: '#FFFFFF',
  bico: '#B45309',
  mesa: '#6D3FD6',
  camara: '#15803D',
  sobreposicao: 'rgba(20,18,38,0.5)',
  cameraTopo: '#8E8A84',
  cameraBase: '#B9AE9E',
};

export const temas: Record<NomeTema, Paleta> = { conceito, grafite, vidro, nord, papel };
export const temaPredefinido: NomeTema = 'conceito';

export const nomesDosTemas: Record<NomeTema, string> = {
  conceito: 'Conceito',
  grafite: 'Grafite',
  vidro: 'Vidro',
  nord: 'Nord',
  papel: 'Papel',
};

export const obterPaleta = (nome: NomeTema | undefined): Paleta =>
  temas[nome ?? temaPredefinido] ?? conceito;

// ───────────────────────── Forma e espaço ─────────────────────────

/** Grade de 8 dp (4 só para ajustes finos). */
export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Margem lateral de todos os ecrãs. */
export const margemEcra = 16;

export const raio = {
  cartao: 20,
  interno: 14, //   botões, campos, linhas seleccionadas, miniaturas
  botao: 14,
  pilulaNav: 15, // pílula do item activo na barra
  chip: 999, //     chips, pílulas de estado, interruptor, trilho de slider
  painel: 28, //    painel inferior (diálogos) e ecrã de câmara
} as const;

export const contornoLargura = { fino: 1, normal: 1.5, forte: 2 } as const;

// ───────────────────────── Tipografia ─────────────────────────
// Família: Inter (a mesma do Figma). Se não estiver incluída, a app cai em Roboto.

export const fonte = {
  regular: 'Inter_400Regular',
  media: 'Inter_500Medium',
  seminegrito: 'Inter_600SemiBold',
  negrito: 'Inter_700Bold',
  alternativa: 'Roboto',
} as const;

export interface EstiloTexto {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
}

/** Mínimo absoluto: 12 sp. */
export const texto: Record<string, EstiloTexto> = {
  tituloEcra: { fontSize: 28, lineHeight: 34, fontWeight: '700' }, //  «Início», «Definições»
  tituloBarra: { fontSize: 22, lineHeight: 28, fontWeight: '700' }, // título de ecrã interno
  secao: { fontSize: 18, lineHeight: 24, fontWeight: '700' }, //       «Histórico recente»
  tituloCartao: { fontSize: 17, lineHeight: 22, fontWeight: '700' }, // «Mover eixos», nome da impressora
  corpo: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  corpoForte: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  botao: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  legenda: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  legendaForte: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '400' }, //       rótulos de barra e chips
  microForte: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  valorTemperatura: { fontSize: 25, lineHeight: 30, fontWeight: '700' },
  percentagemGrande: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  percentagemAnel: { fontSize: 28, lineHeight: 32, fontWeight: '700' },
};

// ───────────────────────── Dimensões dos componentes ─────────────────────────

export const tamanho = {
  alvoToqueMinimo: 48,
  botao: { altura: 48, alturaPequena: 40 },
  botaoCirculo: 46, //            voltar, definições
  pilulaImpressora: { altura: 44 }, // selector de máquina no topo da aba Impressora
  segmentado: { altura: 40, margemInterna: 3 },
  chip: { altura: 32, alturaPequena: 28 },
  pilulaEstado: { altura: 26 }, //   «Imprimindo», «Em uso», «AO VIVO»
  campo: { altura: 48 }, //          pesquisa, IP
  interruptor: { largura: 50, altura: 30, botao: 22 },
  slider: { trilho: 8, botao: 24 },
  barraNav: { altura: 88, pilulaLargura: 64, pilulaAltura: 34, icone: 24 },
  cartaoTemperatura: { altura: 88, barra: 4 },
  cartaoImpressora: { altura: 100 }, // cartão no Início
  linhaLista: { altura: 64, miniatura: 44 },
  cartaoSlotCanvas: { largura: 184, altura: 138 },
  cameraMiniatura: { altura: 128 },
  joystick: { raioExterior: 68, raioCentro: 23 }, // reservado; a Centauri não tem mover eixos
} as const;

/** Anel de progresso. Caixa 110, raio 50, traço 10 (grande); variantes menores. */
export const anel = {
  grande: { caixa: 110, raio: 50, traco: 10 },
  medio: { caixa: 80, raio: 36, traco: 8 },
  pequeno: { caixa: 64, raio: 28, traco: 7 },
} as const;

export const circunferencia = (raioAnel: number) => 2 * Math.PI * raioAnel;
/** Valor para `strokeDasharray` de um anel: [parte preenchida, resto]. */
export const tracoDoAnel = (raioAnel: number, percentagem: number): [number, number] => {
  const c = circunferencia(raioAnel);
  const p = Math.max(0, Math.min(100, percentagem));
  return [(c * p) / 100, c];
};

// ───────────────────────── Movimento ─────────────────────────

export const movimento = {
  rapido: 150, //   toque, interruptor
  normal: 250, //   troca de secção, painel inferior
  anelProgresso: 400,
} as const;

export const opacidade = { desactivado: 0.4, pressionado: 0.85 } as const;

// ───────────────────────── Estados de uma impressora ─────────────────────────

export type EstadoImpressora = 'imprimindo' | 'pausada' | 'pronta' | 'semLigacao' | 'foraDeCasa';

export const corDoEstado = (p: Paleta, e: EstadoImpressora) =>
  ({
    imprimindo: { ponto: p.sucesso, fundo: p.sucessoFundo, texto: p.sucesso },
    pausada: { ponto: p.aviso, fundo: p.avisoFundo, texto: p.aviso },
    pronta: { ponto: p.sucesso, fundo: p.cartaoAlt, texto: p.textoSecundario },
    semLigacao: { ponto: p.perigo, fundo: p.perigoFundo, texto: p.perigo },
    foraDeCasa: { ponto: p.textoSecundario, fundo: p.avisoFundo, texto: p.aviso },
  })[e];

/** Cor de um material a partir do hex que a máquina envia (Canvas, cmd 324). */
export const corDoSlot = (hex: string | undefined, p: Paleta) =>
  hex && /^#?[0-9a-fA-F]{6}$/.test(hex) ? (hex.startsWith('#') ? hex : `#${hex}`) : p.trilha;

/** Acrescenta transparência a um hex #RRGGBB (0–1). */
export const comAlfa = (hex: string, alfa: number) => {
  const a = Math.round(Math.max(0, Math.min(1, alfa)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
};

export type Tema = Paleta;
