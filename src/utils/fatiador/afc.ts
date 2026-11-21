/**
 * Cruzamento entre o G-code fatiado e o filamento que está de facto na pista T0
 * do AFC. O motor escolhe a temperatura pelo perfil; o AFC sabe o material. Se
 * discordarem (PLA na pista, bico a 260 °C), o resultado é bico entupido.
 */

export type Pista = {
  material: string;
  /** `extruder_temp` da pista, quando o AFC o declara. */
  max: number | null;
  carregada: boolean;
};

/** Acima disto o PLA carboniza dentro do bico. */
export const LIMITE_PLA = 235;

/**
 * Pista T0 (CANVAS_1) no Moonraker. `null` = AFC sem resposta: não sabemos,
 * e o ecrã diz isso em vez de assumir que está tudo bem.
 */
export const lerPistaT0 = async (
  ip: string,
  tempoLimite = 4000
): Promise<Pista | null> => {
  try {
    const url = `http://${ip}/printer/objects/query?AFC_lane%20CANVAS_1`;
    const resposta = await Promise.race([
      fetch(url).then(r => r.json()),
      new Promise((_, rejeitar) =>
        setTimeout(() => rejeitar(new Error('tempo')), tempoLimite)
      ),
    ]);
    const pista = (resposta as any)?.result?.status?.['AFC_lane CANVAS_1'];
    if (!pista) return null;
    return {
      material: String(pista.material ?? '').trim(),
      max:
        typeof pista.extruder_temp === 'number' && pista.extruder_temp > 0
          ? pista.extruder_temp
          : null,
      carregada: !!pista.load,
    };
  } catch {
    return null;
  }
};

/** Material da pista quando há risco real; `null` quando não há ou não se sabe. */
export const riscoAfc = (
  pista: Pista | null,
  bico: number | null
): string | null => {
  if (!pista || !pista.material || bico === null) return null;
  const material = pista.material.toUpperCase();
  if (!material.includes('PLA')) return null;
  return bico > LIMITE_PLA ? pista.material : null;
};
