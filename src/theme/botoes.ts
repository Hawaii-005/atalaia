/**
 * Botões no estilo do conceito D ("vidro"): pílula com contorno fino e fundo
 * translúcido do acento. O perigo vive numa bolha própria, longe do primário.
 */
export const BT_PILULA =
  'flex-row items-center justify-center rounded-full border';
export const BT_ACENTO = `${BT_PILULA} border-brand/45 bg-brand/12`;
export const BT_PERIGO = `${BT_PILULA} border-state-danger/55 bg-state-danger/12`;
export const BT_NEUTRA = `${BT_PILULA} border-line bg-canvas-sunken`;
export const BT_APAGADA = `${BT_PILULA} border-line bg-canvas-sunken opacity-50`;

export const TX_ACENTO = 'text-brand-texto font-semibold';
export const TX_PERIGO = 'text-state-danger font-semibold';
export const TX_NEUTRO = 'text-ink font-semibold';
