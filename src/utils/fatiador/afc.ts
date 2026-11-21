/**
 * Cruzamento entre o G-code fatiado e o filamento que está de facto na pista do
 * AFC que serve a ferramenta do PRINT_START. O motor escolhe temperaturas pelo
 * perfil; o AFC sabe o material. Se discordarem, o resultado é bico entupido ou
 * peça a descolar.
 */

export type Pista = {
  nome: string;
  material: string;
  /** `extruder_temp` declarado pela pista (0 = não declarado). */
  bico: number | null;
  mesa: number | null;
  /** Ferramentas servidas, ex.: ["T0"]. */
  mapa: string[];
  carregada: boolean;
};

export type AvisoAfc =
  | 'plaLimite'
  | 'materialDiferente'
  | 'bicoBaixo'
  | 'mesaBaixa'
  | 'pistaDesconhecida';

/** Acima disto o PLA carboniza dentro do bico. */
export const LIMITE_PLA = 235;

/** Intervalos usuais por material; usados quando a pista não declara os seus. */
export const FAIXAS: Record<
  string,
  { bico: [number, number]; mesa: [number, number] }
> = {
  PLA: { bico: [190, 235], mesa: [50, 65] },
  PETG: { bico: [220, 255], mesa: [70, 90] },
  ABS: { bico: [235, 265], mesa: [90, 110] },
  ASA: { bico: [235, 265], mesa: [90, 110] },
  TPU: { bico: [195, 235], mesa: [30, 60] },
};

const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

/** O HTTP do AFC vai em claro: só se fala com endereços de rede privada. */
export const hostPrivado = (endereco: string): boolean => {
  const host = endereco
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.ts.net')
  ) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
};

const pedirJson = async (url: string, tempoLimite: number): Promise<any> =>
  Promise.race([
    fetch(url).then(r => r.json()),
    new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error('tempo')), tempoLimite)
    ),
  ]);

/**
 * Todas as pistas `AFC_lane` do Moonraker. `null` = AFC não respondeu (não se
 * sabe), `[]` = respondeu mas não tem pistas.
 */
export const lerPistas = async (
  ip: string,
  tempoLimite = 4000
): Promise<Pista[] | null> => {
  if (!hostPrivado(ip)) return null;
  try {
    const lista = await pedirJson(
      `http://${ip}/printer/objects/list`,
      tempoLimite
    );
    const nomes: string[] = (lista?.result?.objects ?? []).filter(
      (n: unknown) => typeof n === 'string' && n.startsWith('AFC_lane ')
    );
    if (!nomes.length) return [];
    const consulta = nomes.map(n => encodeURIComponent(n)).join('&');
    const resposta = await pedirJson(
      `http://${ip}/printer/objects/query?${consulta}`,
      tempoLimite
    );
    const status = resposta?.result?.status ?? {};
    return nomes.map(nome => {
      const l = status[nome] ?? {};
      const mapa = Array.isArray(l.map)
        ? l.map.map(String)
        : l.current_map
          ? [String(l.current_map)]
          : [];
      return {
        nome,
        material: String(l.material ?? '').trim(),
        bico: numero(l.extruder_temp),
        mesa: numero(l.bed_temp),
        mapa,
        carregada: !!l.load,
      };
    });
  } catch {
    return null;
  }
};

/** A pista mapeada para a ferramenta do PRINT_START (`TOOL=`). */
export const pistaDoTool = (
  pistas: Pista[] | null,
  ferramenta: number | null
): Pista | null => {
  if (!pistas || ferramenta === null) return null;
  const alvo = `T${ferramenta}`;
  return pistas.find(p => p.mapa.includes(alvo)) ?? null;
};

const base = (material: string): string =>
  material.toUpperCase().split(/[-_\s]/)[0];

/** Discordâncias entre o G-code e a pista, por ordem de gravidade. */
export const avisosAfc = (
  pista: Pista | null,
  gcode: { material: string; bico: number | null; mesa: number | null }
): AvisoAfc[] => {
  if (!pista) return ['pistaDesconhecida'];
  const avisos: AvisoAfc[] = [];
  const material = pista.material.toUpperCase();
  const faixa = FAIXAS[base(material)] ?? null;

  if (
    material.includes('PLA') &&
    gcode.bico !== null &&
    gcode.bico > LIMITE_PLA
  ) {
    avisos.push('plaLimite');
  }
  const noGcode = base(gcode.material || '');
  if (noGcode && material && noGcode !== base(material)) {
    avisos.push('materialDiferente');
  }
  if (faixa && gcode.bico !== null && gcode.bico < faixa.bico[0]) {
    avisos.push('bicoBaixo');
  }
  if (faixa && gcode.mesa !== null && gcode.mesa < faixa.mesa[0]) {
    avisos.push('mesaBaixa');
  }
  return avisos;
};

/**
 * Regra do E5 («Enviar e arrancar»): qualquer aviso desativa o botão, com
 * opção explícita de ignorar. Sem resposta do AFC não há como ignorar: exige
 * confirmação consciente.
 */
export const bloqueioEnvio = (
  avisos: AvisoAfc[]
): { bloqueado: boolean; requerConfirmacao: boolean } => ({
  bloqueado: avisos.length > 0,
  requerConfirmacao: avisos.includes('pistaDesconhecida'),
});
