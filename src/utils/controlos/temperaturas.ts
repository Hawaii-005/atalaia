/**
 * Predefinições de temperatura por material.
 *
 * Os limites vêm do próprio comando (`temperatureCommand`): bico 0–300,
 * mesa 0–110, câmara 0–60. Nenhum valor fora disto chega a ser enviado.
 */

export type Material = 'PLA' | 'PETG' | 'ABS' | 'TPU';

export type Preset = { bico: number; mesa: number };

export const MATERIAIS: Material[] = ['PLA', 'PETG', 'ABS', 'TPU'];

export const PRESETS: Record<Material, Preset> = {
  PLA: { bico: 210, mesa: 60 },
  PETG: { bico: 240, mesa: 80 },
  ABS: { bico: 260, mesa: 100 },
  TPU: { bico: 225, mesa: 50 },
};

export const LIMITES = {
  bico: { min: 0, max: 300 },
  mesa: { min: 0, max: 110 },
} as const;

export const CHAVE_TEMPERATURAS = 'atalaia.controlos.temperaturas.v1';

export const limitar = (valor: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(valor)));

export const presetValido = (p: Preset): Preset => ({
  bico: limitar(p.bico, LIMITES.bico.min, LIMITES.bico.max),
  mesa: limitar(p.mesa, LIMITES.mesa.min, LIMITES.mesa.max),
});

/** Lê presets guardados, caindo nos valores por omissão campo a campo. */
export const lerPresets = (cru: unknown): Record<Material, Preset> => {
  const base: Record<Material, Preset> = { ...PRESETS };
  if (!cru || typeof cru !== 'object') return base;
  const c = cru as Record<string, unknown>;
  MATERIAIS.forEach(material => {
    const valor = c[material];
    if (!valor || typeof valor !== 'object') return;
    const { bico, mesa } = valor as Partial<Preset>;
    if (typeof bico !== 'number' || typeof mesa !== 'number') return;
    base[material] = presetValido({ bico, mesa });
  });
  return base;
};

/** Arrefecer: alvos a zero, sem mexer nas ventoinhas. */
export const PRESET_ARREFECER: Preset = { bico: 0, mesa: 0 };

export const estaArrefecido = (p: Preset): boolean =>
  p.bico === 0 && p.mesa === 0;
