/**
 * Operações puras sobre bobinas. Sem AsyncStorage, sem rede, sem React:
 * tudo o que muda o inventário passa por aqui e é testável em node.
 */
import { LIMITE_QUASE_NO_FIM, SLOT_MAX, SLOT_MIN, Spool } from './modelo';

const arredondar1 = (valor: number): number => Math.round(valor * 10) / 10;

/** Aceita `#rgb`, `#rrggbb` (com ou sem cardinal) e devolve `#rrggbb`. */
export const normalizarHex = (valor?: string): string | undefined => {
  if (!valor) return undefined;
  const hex = valor.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map(c => c + c)
      .join('')
      .toLowerCase()}`;
  }
  return undefined;
};

export const idNovo = (
  agora: number = Date.now(),
  aleatorio: number = Math.random()
): string => `${agora}-${aleatorio.toString(36).slice(2, 8)}`;

export interface NovaBobina {
  nome: string;
  marca?: string;
  material: string;
  cor: string;
  pesoInicial: number;
  preco?: number;
  restante?: number;
  dataCompra?: string;
  notas?: string;
  canvasSlot?: number | null;
  printerId: string;
  id?: string;
}

const numeroFinito = (valor: unknown, campo: string): number => {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) {
    throw new Error(`${campo} tem de ser um número.`);
  }
  return n;
};

export const slotValidoOuIndefinido = (slot: unknown): number | undefined => {
  if (slot === null || slot === undefined || slot === '') return undefined;
  const n = Number(slot);
  if (!Number.isInteger(n) || n < SLOT_MIN || n > SLOT_MAX) return undefined;
  return n;
};

/** Cria uma bobina com os valores por omissão coerentes. */
export const criarBobina = (
  dados: NovaBobina,
  agora: number = Date.now()
): Spool => {
  const nome = (dados.nome ?? '').trim();
  if (!nome) throw new Error('A bobina precisa de um nome.');
  if (!dados.printerId) throw new Error('A bobina precisa de uma impressora.');

  const pesoInicial = numeroFinito(dados.pesoInicial, 'pesoInicial');
  if (pesoInicial < 0) throw new Error('O peso inicial não pode ser negativo.');

  const preco = numeroFinito(dados.preco ?? 0, 'preco');
  if (preco < 0) throw new Error('O preço não pode ser negativo.');

  const restante =
    dados.restante === undefined
      ? pesoInicial
      : Math.max(
          0,
          Math.min(pesoInicial, numeroFinito(dados.restante, 'restante'))
        );

  const cor = normalizarHex(dados.cor) ?? '#808080';

  return {
    id: dados.id ?? idNovo(agora),
    nome,
    marca: (dados.marca ?? '').trim(),
    material: (dados.material ?? '').trim().toUpperCase() || 'PLA',
    cor,
    pesoInicial,
    restante: arredondar1(restante),
    preco,
    dataCompra: dados.dataCompra?.trim() || undefined,
    notas: dados.notas?.trim() || undefined,
    canvasSlot: slotValidoOuIndefinido(dados.canvasSlot),
    printerId: dados.printerId,
    criadoEm: agora,
  };
};

/** Edita campos de uma bobina. `id` e `criadoEm` nunca mudam. */
export const editarBobina = (
  bobina: Spool,
  alteracoes: Partial<Omit<Spool, 'id' | 'criadoEm' | 'canvasSlot'>> & {
    canvasSlot?: number | null;
  }
): Spool => {
  const pesoInicial =
    alteracoes.pesoInicial === undefined
      ? bobina.pesoInicial
      : numeroFinito(alteracoes.pesoInicial, 'pesoInicial');
  if (pesoInicial < 0) throw new Error('O peso inicial não pode ser negativo.');

  const preco =
    alteracoes.preco === undefined
      ? bobina.preco
      : numeroFinito(alteracoes.preco, 'preco');
  if (preco < 0) throw new Error('O preço não pode ser negativo.');

  const restante =
    alteracoes.restante === undefined
      ? bobina.restante
      : numeroFinito(alteracoes.restante, 'restante');

  return {
    ...bobina,
    ...alteracoes,
    nome: (alteracoes.nome ?? bobina.nome).trim() || bobina.nome,
    marca:
      alteracoes.marca === undefined ? bobina.marca : alteracoes.marca.trim(),
    cor: normalizarHex(alteracoes.cor ?? bobina.cor) ?? bobina.cor,
    pesoInicial,
    preco,
    restante: arredondar1(Math.max(0, Math.min(pesoInicial, restante))),
    canvasSlot:
      alteracoes.canvasSlot === undefined
        ? bobina.canvasSlot
        : slotValidoOuIndefinido(alteracoes.canvasSlot),
  };
};

export const apagarBobina = (bobinas: Spool[], id: string): Spool[] =>
  bobinas.filter(bobina => bobina.id !== id);

/** Quanto custa o rolo por grama. 0 quando o preço ou o peso não são úteis. */
export const custoPorGrama = (bobina: Spool): number =>
  bobina.pesoInicial > 0 && bobina.preco > 0
    ? bobina.preco / bobina.pesoInicial
    : 0;

/** Custo do filamento gasto num trabalho. */
export const custoDeConsumo = (bobina: Spool, gramas: number): number => {
  if (!Number.isFinite(gramas) || gramas <= 0) return 0;
  return Math.round(custoPorGrama(bobina) * gramas * 100) / 100;
};

/**
 * Desconta gramas ao restante. Nunca fica negativo e um valor negativo ou
 * inválido não repõe filamento (é ignorado).
 */
export const descontarConsumo = (bobina: Spool, gramas: number): Spool => {
  if (!Number.isFinite(gramas) || gramas <= 0) return bobina;
  return {
    ...bobina,
    restante: arredondar1(Math.max(0, bobina.restante - gramas)),
  };
};

/** Percentagem que resta, arredondada a 1 decimal (0 quando não se sabe). */
export const percentagemRestante = (bobina: Spool): number => {
  if (!(bobina.pesoInicial > 0)) return 0;
  const pct = (bobina.restante / bobina.pesoInicial) * 100;
  return arredondar1(Math.max(0, Math.min(100, pct)));
};

export const quaseNoFim = (
  bobina: Spool,
  limite: number = LIMITE_QUASE_NO_FIM
): boolean => percentagemRestante(bobina) <= limite;

/** Bobinas que contam para o inventário activo (as arquivadas ficam de fora). */
export const bobinasActivas = (bobinas: Spool[]): Spool[] =>
  bobinas.filter(bobina => !bobina.arquivada);

export const bobinaDoSlot = (
  bobinas: Spool[],
  printerId: string,
  slot: number
): Spool | undefined =>
  bobinas.find(
    bobina =>
      !bobina.arquivada &&
      bobina.printerId === printerId &&
      bobina.canvasSlot === slot
  );

/**
 * Liga uma bobina a um slot. Um slot só pode ter uma bobina: se houver outra
 * no mesmo slot/impressora, é desassociada.
 */
export const associarSlot = (
  bobinas: Spool[],
  spoolId: string,
  printerId: string,
  slot: number
): Spool[] => {
  const alvo = bobinas.find(bobina => bobina.id === spoolId);
  if (!alvo) throw new Error('Bobina não encontrada.');
  if (alvo.printerId !== printerId) {
    throw new Error('A bobina pertence a outra impressora.');
  }
  const slotLimpo = slotValidoOuIndefinido(slot);
  if (slotLimpo === undefined) throw new Error('Slot inválido.');

  return bobinas.map(bobina => {
    if (bobina.id === spoolId) {
      return { ...bobina, canvasSlot: slotLimpo };
    }
    if (bobina.printerId === printerId && bobina.canvasSlot === slotLimpo) {
      return { ...bobina, canvasSlot: undefined };
    }
    return bobina;
  });
};

export const desassociarSlot = (bobinas: Spool[], spoolId: string): Spool[] =>
  bobinas.map(bobina =>
    bobina.id === spoolId ? { ...bobina, canvasSlot: undefined } : bobina
  );
