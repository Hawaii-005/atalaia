/**
 * Botões no estilo do conceito N ("cotas de altitude"): caixa de contorno fino
 * (1,5 px) com etiqueta em maiúsculas espaçadas, como marcas de estaleiro.
 * O perigo muda a cor do contorno, não enche o botão.
 */
export const BT_BASE =
  'flex-row items-center justify-center rounded-md border-[1.5px]';

export const BT_ACENTO = `${BT_BASE} border-brand bg-brand/10`;
export const BT_PERIGO = `${BT_BASE} border-state-danger bg-state-danger/10`;
export const BT_NEUTRA = `${BT_BASE} border-line bg-canvas-sunken`;
export const BT_APAGADA = `${BT_BASE} border-line bg-canvas-sunken opacity-45`;

export const TX_BASE = 'text-[11px] font-semibold uppercase tracking-[1.2px]';
export const TX_ACENTO = `${TX_BASE} text-brand-texto`;
export const TX_PERIGO = `${TX_BASE} text-state-danger`;
export const TX_NEUTRO = `${TX_BASE} text-ink`;
