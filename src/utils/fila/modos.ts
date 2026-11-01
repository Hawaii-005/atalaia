/**
 * Modos de arranque da fila, por impressora.
 *
 * Só existem dois modos, e nenhum deles arranca sem um toque:
 *
 * - `manual` — no fim de uma impressão não acontece nada; o trabalho fica
 *   pendente até alguém o arrancar.
 * - `confirmar` — no fim aparece «Mesa limpa?» com uma contagem. Se a contagem
 *   chegar ao fim **sem toque**, não arranca nada: o pedido desaparece e o
 *   trabalho continua pendente.
 *
 * O modo «automático» dos wireframes (arrancar sem ninguém confirmar a mesa) não
 * está implementado de propósito: contradiz a regra de confirmar a mesa limpa.
 */
export const MODOS = ['manual', 'confirmar'] as const;

export type ModoArranque = (typeof MODOS)[number];

/** Contagens permitidas, em segundos. */
export const CONTAGENS = [15, 30, 60, 120] as const;

export type Contagem = (typeof CONTAGENS)[number];

export interface ModoConfig {
  modo: ModoArranque;
  contagemSeg: Contagem;
}

export const MODO_PREDEFINIDO: ModoConfig = { modo: 'manual', contagemSeg: 60 };

export const CHAVE_MODOS = 'atalaia.fila.modos.v1';
/** Chave antiga: um booleano global. */
export const CHAVE_FILA_AUTO = 'filaAuto';

const ehModo = (valor: unknown): valor is ModoArranque =>
  typeof valor === 'string' && (MODOS as readonly string[]).includes(valor);

const ehContagem = (valor: unknown): valor is Contagem =>
  typeof valor === 'number' && (CONTAGENS as readonly number[]).includes(valor);

export const lerModoConfig = (cru: unknown): ModoConfig => {
  if (!cru || typeof cru !== 'object') return { ...MODO_PREDEFINIDO };
  const c = cru as Record<string, unknown>;
  return {
    modo: ehModo(c.modo) ? c.modo : MODO_PREDEFINIDO.modo,
    contagemSeg: ehContagem(c.contagemSeg)
      ? c.contagemSeg
      : MODO_PREDEFINIDO.contagemSeg,
  };
};

export const lerModos = (cru: unknown): Record<string, ModoConfig> => {
  if (!cru || typeof cru !== 'object' || Array.isArray(cru)) return {};
  const mapa: Record<string, ModoConfig> = {};
  Object.entries(cru as Record<string, unknown>).forEach(([id, valor]) => {
    if (!id) return;
    mapa[id] = lerModoConfig(valor);
  });
  return mapa;
};

/** O `filaAuto` antigo: `'1'` era «perguntar antes de arrancar». */
export const migrarFilaAuto = (
  valor: string | null | undefined
): ModoConfig => ({
  ...MODO_PREDEFINIDO,
  modo: valor === '1' ? 'confirmar' : 'manual',
});

/** No fim de uma impressão, pede confirmação de mesa limpa? */
export const pedeConfirmacao = (config: ModoConfig): boolean =>
  config.modo === 'confirmar';

/** Configuração efetiva de uma impressora (nunca `undefined`). */
export const modoDe = (
  modos: Record<string, ModoConfig>,
  printerId: string
): ModoConfig => modos[printerId] ?? modos['*'] ?? { ...MODO_PREDEFINIDO };

/** Segundos restantes, para a interface (nunca negativo). */
export const segundosRestantes = (fim: number, agora: number): number =>
  Math.max(0, Math.ceil((fim - agora) / 1000));
