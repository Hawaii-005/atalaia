import {
  LIMITES,
  MATERIAIS,
  PRESETS,
  PRESET_ARREFECER,
  estaArrefecido,
  lerPresets,
  limitar,
  presetValido,
} from '../src/utils/controlos/temperaturas';

describe('temperaturas', () => {
  it('tem presets para os quatro materiais, dentro dos limites', () => {
    for (const material of MATERIAIS) {
      const preset = PRESETS[material];
      expect(preset.bico).toBeLessThanOrEqual(LIMITES.bico.max);
      expect(preset.mesa).toBeLessThanOrEqual(LIMITES.mesa.max);
    }
  });

  it('limita em vez de rejeitar', () => {
    expect(limitar(400, 0, 300)).toBe(300);
    expect(limitar(-10, 0, 300)).toBe(0);
    expect(limitar(210.6, 0, 300)).toBe(211);
  });

  it('normaliza um preset fora dos limites', () => {
    expect(presetValido({ bico: 999, mesa: 999 })).toEqual({
      bico: 300,
      mesa: 110,
    });
  });

  it('lê presets guardados e ignora lixo campo a campo', () => {
    const lido = lerPresets({
      PLA: { bico: 205, mesa: 55 },
      ABS: { bico: 'x' },
    });
    expect(lido.PLA).toEqual({ bico: 205, mesa: 55 });
    expect(lido.ABS).toEqual(PRESETS.ABS);
    expect(lido.PETG).toEqual(PRESETS.PETG);
  });

  it('arrefecer é zero em ambos os alvos', () => {
    expect(estaArrefecido(PRESET_ARREFECER)).toBe(true);
    expect(estaArrefecido({ bico: 0, mesa: 60 })).toBe(false);
  });
});
