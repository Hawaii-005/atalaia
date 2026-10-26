/**
 * Ataláia — tokens de design (v6)
 * Valores em dp, para um ecrã de referência de 412 × 915.
 * Regra: nenhum ecrã ou componente usa cor ou número solto; tudo vem daqui.
 */

// ───────────────────────── Paleta ─────────────────────────

export type NomeTema = 'ametista' | 'esmeralda' | 'cobre' | 'citrino' | 'quartzo' | 'azulejo';

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

/**
 * Quatro temas, todos escuros, o mesmo conceito visual. Os nomes são de pedra
 * e metal: Ametista (o aprovado), Esmeralda, Cobre e Citrino (verde+laranja).
 */
const ametista: Paleta = {
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

const esmeralda: Paleta = {
  modo: 'escuro',
  fundo: '#0E1A15',
  cartao: '#16261F',
  cartaoAlt: '#1E3329',
  trilha: '#2A4438',
  contorno: '#2A4438',
  barraNav: '#0C1712',
  pilulaNav: '#1E4B3A',
  texto: '#FFFFFF',
  textoSecundario: '#9CB3A8',
  primaria: '#34D399',
  textoSobrePrimaria: '#06261A',
  sucesso: '#4ADE80',
  sucessoFundo: '#16352A',
  aviso: '#FBBF24',
  avisoFundo: '#3A2A08',
  perigo: '#F87171',
  perigoFundo: '#3B1F22',
  textoSobrePerigo: '#2B0B0B',
  bico: '#FBBF24',
  mesa: '#34D399',
  camara: '#A3E635',
  sobreposicao: 'rgba(0,0,0,0.62)',
  cameraTopo: '#1B2B24',
  cameraBase: '#4F5F45',
};

const cobre: Paleta = {
  modo: 'escuro',
  fundo: '#1A1210',
  cartao: '#241A16',
  cartaoAlt: '#2F211C',
  trilha: '#40302A',
  contorno: '#40302A',
  barraNav: '#150F0D',
  pilulaNav: '#4A2C21',
  texto: '#FFF6F0',
  textoSecundario: '#B9A196',
  primaria: '#F97316',
  textoSobrePrimaria: '#2A1206',
  sucesso: '#4ADE80',
  sucessoFundo: '#1E3527',
  aviso: '#FBBF24',
  avisoFundo: '#3A2A08',
  perigo: '#F87171',
  perigoFundo: '#3B1F1F',
  textoSobrePerigo: '#2B0B0B',
  bico: '#FDBA74',
  mesa: '#F97316',
  camara: '#4ADE80',
  sobreposicao: 'rgba(0,0,0,0.62)',
  cameraTopo: '#2A211D',
  cameraBase: '#6B5344',
};

/** Verde-lima sobre base azeitona: o verde e o laranja juntos. */
const citrino: Paleta = {
  modo: 'escuro',
  fundo: '#131A12',
  cartao: '#1C261A',
  cartaoAlt: '#26331F',
  trilha: '#35452A',
  contorno: '#35452A',
  barraNav: '#101610',
  pilulaNav: '#3E5222',
  texto: '#F7FFF0',
  textoSecundario: '#A8B79B',
  primaria: '#A3E635',
  textoSobrePrimaria: '#1A2405',
  sucesso: '#22C55E',
  sucessoFundo: '#1B3320',
  aviso: '#FB923C',
  avisoFundo: '#3A2410',
  perigo: '#F87171',
  perigoFundo: '#3B1F1F',
  textoSobrePerigo: '#2B0B0B',
  bico: '#FB923C',
  mesa: '#A3E635',
  camara: '#FB923C',
  sobreposicao: 'rgba(0,0,0,0.62)',
  cameraTopo: '#222B1B',
  cameraBase: '#5F6540',
};

/** Claro: a mesma ideia do Ametista, em fundo de porcelana. */
const quartzo: Paleta = {
  modo: 'claro',
  fundo: '#F6F4FB',
  cartao: '#FFFFFF',
  cartaoAlt: '#EDE9F7',
  trilha: '#D9D3EA',
  contorno: '#D9D3EA',
  barraNav: '#FFFFFF',
  pilulaNav: '#E4DBFA',
  texto: '#1B1730',
  textoSecundario: '#6B6480',
  primaria: '#7C3AED',
  textoSobrePrimaria: '#FFFFFF',
  sucesso: '#15803D',
  sucessoFundo: '#DCFCE7',
  aviso: '#B45309',
  avisoFundo: '#FEF3C7',
  perigo: '#DC2626',
  perigoFundo: '#FEE2E2',
  textoSobrePerigo: '#FFFFFF',
  bico: '#B45309',
  mesa: '#7C3AED',
  camara: '#15803D',
  sobreposicao: 'rgba(18,14,40,0.45)',
  cameraTopo: '#CFCADD',
  cameraBase: '#A9A2BA',
};

/** Claro sem roxo: branco de azulejo com azul. */
const azulejo: Paleta = {
  modo: 'claro',
  fundo: '#F2F6FB',
  cartao: '#FFFFFF',
  cartaoAlt: '#E7EEF8',
  trilha: '#CFDBEA',
  contorno: '#CFDBEA',
  barraNav: '#FFFFFF',
  pilulaNav: '#D8E6FB',
  texto: '#152238',
  textoSecundario: '#5B6B82',
  primaria: '#2563EB',
  textoSobrePrimaria: '#FFFFFF',
  sucesso: '#15803D',
  sucessoFundo: '#DCFCE7',
  aviso: '#B45309',
  avisoFundo: '#FEF3C7',
  perigo: '#DC2626',
  perigoFundo: '#FEE2E2',
  textoSobrePerigo: '#FFFFFF',
  bico: '#B45309',
  mesa: '#2563EB',
  camara: '#15803D',
  sobreposicao: 'rgba(12,24,44,0.45)',
  cameraTopo: '#C9D6E6',
  cameraBase: '#A2B0C2',
};

export const temas: Record<NomeTema, Paleta> = { ametista, esmeralda, cobre, citrino, quartzo, azulejo };
export const temaPredefinido: NomeTema = 'ametista';

export const nomesDosTemas: Record<NomeTema, string> = {
  ametista: 'Ametista',
  esmeralda: 'Esmeralda',
  cobre: 'Cobre',
  citrino: 'Citrino',
  quartzo: 'Quartzo',
  azulejo: 'Azulejo',
};

export const obterPaleta = (nome: NomeTema | undefined): Paleta =>
  temas[nome ?? temaPredefinido] ?? ametista;

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
