/**
 * Cruzamento entre o G-code fatiado e o filamento que está de facto na pista do
 * AFC que serve a ferramenta do PRINT_START. O motor escolhe temperaturas pelo
 * perfil; o AFC sabe o material. Se discordarem, o resultado é bico entupido ou
 * peça a descolar.
 */

import { pedirJsonLocal, hostPrivado } from '../httpLocal';

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

/** Mesa mínima por material e por chapa: Cool Plate imprime PLA a 35 °C. */
export const MESA_MINIMA: Record<string, Record<string, number>> = {
  PLA: { 'Textured PEI Plate': 55, 'Cool Plate': 30 },
  PETG: { 'Textured PEI Plate': 70, 'Cool Plate': 70 },
  ABS: { 'Textured PEI Plate': 90, 'Cool Plate': 90 },
  ASA: { 'Textured PEI Plate': 90, 'Cool Plate': 90 },
  TPU: { 'Textured PEI Plate': 30, 'Cool Plate': 30 },
};

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
    const lista = await pedirJsonLocal(
      `http://${ip}/printer/objects/list`,
      tempoLimite
    );
    const nomes: string[] = (lista?.result?.objects ?? []).filter(
      (n: unknown) => typeof n === 'string' && n.startsWith('AFC_lane ')
    );
    if (!nomes.length) return [];
    const consulta = nomes.map(n => encodeURIComponent(n)).join('&');
    const resposta = await pedirJsonLocal(
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

export type NivelAviso = 'critico' | 'aviso';

/** Crítico bloqueia o envio; aviso pede só confirmação. */
export const nivelAviso = (aviso: AvisoAfc): NivelAviso =>
  aviso === 'plaLimite' ||
  aviso === 'materialDiferente' ||
  aviso === 'pistaDesconhecida'
    ? 'critico'
    : 'aviso';

/** Discordâncias entre o G-code e a pista, por ordem de gravidade. */
export const avisosAfc = (
  pista: Pista | null,
  gcode: { material: string; bico: number | null; mesa: number | null },
  chapa = 'Textured PEI Plate'
): AvisoAfc[] => {
  if (!pista) return ['pistaDesconhecida'];
  const avisos: AvisoAfc[] = [];
  const material = pista.material.toUpperCase();
  const familia = base(material);
  const faixa = FAIXAS[familia] ?? null;

  // Só PLA puro: PLA-CF e afins têm bico próprio e o limite de 235 não lhes
  // pertence (o utilizador pediu-o explicitamente).
  if (material === 'PLA' && gcode.bico !== null && gcode.bico > LIMITE_PLA) {
    avisos.push('plaLimite');
  }
  const noGcode = base(gcode.material || '');
  if (noGcode && material && noGcode !== familia) {
    avisos.push('materialDiferente');
  }
  if (faixa && gcode.bico !== null && gcode.bico < faixa.bico[0]) {
    avisos.push('bicoBaixo');
  }
  const mesaMinima = MESA_MINIMA[familia]?.[chapa];
  if (
    mesaMinima !== undefined &&
    gcode.mesa !== null &&
    gcode.mesa < mesaMinima
  ) {
    avisos.push('mesaBaixa');
  }
  return avisos;
};

/**
 * Regra do E5 («Enviar e arrancar»):
 * - crítico (PLA acima de 235, material diferente): botão desativado, com
 *   opção explícita de ignorar;
 * - aviso (bico ou mesa abaixo do intervalo): pede confirmação;
 * - AFC mudo: bloqueia e não deixa ignorar — exige confirmação consciente.
 */
export const bloqueioEnvio = (
  avisos: AvisoAfc[]
): {
  nivel: 'nenhum' | NivelAviso;
  bloqueado: boolean;
  podeIgnorar: boolean;
  requerConfirmacao: boolean;
} => {
  const critico = avisos.filter(a => nivelAviso(a) === 'critico');
  const desconhecido = avisos.includes('pistaDesconhecida');
  return {
    nivel: critico.length ? 'critico' : avisos.length ? 'aviso' : 'nenhum',
    bloqueado: critico.length > 0,
    podeIgnorar: critico.length > 0 && !desconhecido,
    requerConfirmacao: critico.length > 0 ? desconhecido : avisos.length > 0,
  };
};
