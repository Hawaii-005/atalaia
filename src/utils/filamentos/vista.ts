import { CanvasTray } from '../commands';
import { LIMITE_QUASE_NO_FIM, SLOT_MAX, SLOT_MIN, Spool } from './modelo';
import {
  custoPorGrama,
  percentagemRestante,
  quaseNoFim,
  slotValidoOuIndefinido,
} from './operacoes';

/**
 * Vista de um slot do CANVAS: junta o que a impressora reporta (marca, tipo,
 * cor, temperaturas) com o que só existe localmente (a bobina associada, o
 * peso e o custo). A impressora nunca dá gramas — quando não há bobina, o
 * cartão tem de o dizer em vez de inventar um número.
 */

export type EstadoSlot = 'vazio' | 'semBobina' | 'ok' | 'quaseNoFim';

export interface VistaSlot {
  trayId: number;
  /** «A1».. «A4». */
  rotulo: string;
  /** Escolhido na impressora como filamento activo. */
  emUso: boolean;
  /** Cor em hex, ou null quando a impressora não a reporta. */
  cor: string | null;
  corNome: string;
  material: string;
  marca: string;
  nome: string;
  minTemp: number | null;
  maxTemp: number | null;
  carregado: boolean;
  estado: EstadoSlot;
  bobina?: Spool;
  restanteG?: number;
  percentagem?: number;
  valorRestante?: number;
}

const CORES: [string, [number, number, number]][] = [
  ['preto', [20, 20, 20]],
  ['branco', [245, 245, 245]],
  ['cinza', [140, 140, 140]],
  ['vermelho', [220, 40, 40]],
  ['laranja', [240, 140, 50]],
  ['amarelo', [235, 200, 60]],
  ['verde', [40, 140, 70]],
  ['azul', [50, 110, 210]],
  ['roxo', [130, 80, 200]],
  ['rosa', [230, 120, 170]],
  ['castanho', [160, 110, 60]],
];

/**
 * Nome aproximado da cor a partir do hex. O objectivo não é acertar no nome
 * comercial: é haver texto ao lado da amostra, para quem não distingue cores.
 */
export const nomeDaCor = (hex?: string | null): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return '';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  let melhor = CORES[0][0];
  let dist = Infinity;
  for (const [nome, [ar, ag, ab]] of CORES) {
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < dist) {
      dist = d;
      melhor = nome;
    }
  }
  return melhor;
};

const hexLimpo = (valor?: string): string | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((valor ?? '').trim());
  return m ? `#${m[1].toLowerCase()}` : null;
};

/**
 * Cor pronta para o `style`. O `hexDe` do tema espera um triplo «30 27 51»,
 * não um hex — passar-lhe `#077747` rebentava com `toString` de undefined.
 */
export const corHex = (valor?: string | null, recurso = '#808080'): string =>
  hexLimpo(valor ?? undefined) ?? recurso;

const numeroOuNull = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) && valor > 0
    ? Math.round(valor)
    : null;

const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

/**
 * Constrói os cartões dos slots, por ordem A1..A4.
 *
 * `bobinas` deve trazer todo o inventário da impressora: só as não arquivadas
 * contam, e cada slot usa a bobina que lhe estiver associada.
 */
export const construirVistaSlots = (
  trays: CanvasTray[],
  bobinas: Spool[],
  printerId: string,
  limite: number = LIMITE_QUASE_NO_FIM,
  trayAtivo: number = -1
): VistaSlot[] => {
  const porSlot = new Map<number, CanvasTray>();
  for (const tray of trays) {
    const slot = slotValidoOuIndefinido(tray?.tray_id);
    if (slot === undefined) continue;
    if (!porSlot.has(slot)) porSlot.set(slot, tray);
  }

  const total = Math.max(SLOT_MAX - SLOT_MIN + 1, porSlot.size);
  const vista: VistaSlot[] = [];

  for (let slot = SLOT_MIN; slot < SLOT_MIN + total; slot += 1) {
    const tray = porSlot.get(slot);
    const material = texto(tray?.filament_type);
    const marca = texto(tray?.brand);
    const cor = hexLimpo(tray?.filament_color);
    const nome = texto(tray?.filament_name);

    const bobina = bobinas.find(
      item =>
        !item.arquivada &&
        item.printerId === printerId &&
        item.canvasSlot === slot
    );

    const base: VistaSlot = {
      trayId: slot,
      rotulo: `A${slot + 1}`,
      emUso: slot === trayAtivo,
      cor,
      corNome: nomeDaCor(cor),
      material,
      marca,
      nome,
      minTemp: numeroOuNull(tray?.min_nozzle_temp),
      maxTemp: numeroOuNull(tray?.max_nozzle_temp),
      carregado: tray?.status === 1,
      estado: 'vazio',
    };

    if (!bobina) {
      vista.push({
        ...base,
        estado: material || marca || cor ? 'semBobina' : 'vazio',
      });
      continue;
    }

    vista.push({
      ...base,
      estado: quaseNoFim(bobina, limite) ? 'quaseNoFim' : 'ok',
      bobina,
      restanteG: bobina.restante,
      percentagem: percentagemRestante(bobina),
      valorRestante:
        Math.round(custoPorGrama(bobina) * bobina.restante * 100) / 100,
    });
  }

  return vista;
};
