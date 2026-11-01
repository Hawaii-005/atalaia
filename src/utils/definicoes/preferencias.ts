/**
 * Preferências das Definições que ainda não existiam.
 *
 * Preço do kWh e potência da impressora servem para estimar o custo
 * energético de um trabalho. O valor 0 significa «por preencher» — o ecrã
 * mostra «—» em vez de inventar um número.
 *
 * As chaves são novas e próprias: nada aqui mexe nas preferências antigas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../log';

export const CHAVE_PRECO_KWH = 'atalaia.definicoes.precoKwh';
export const CHAVE_POTENCIA_W = 'atalaia.definicoes.potenciaW';

/** €/kWh. 0 = por preencher; o tecto evita gralhas (5 €/kWh já é absurdo). */
export const KWH_MIN = 0;
export const KWH_MAX = 5;
export const KWH_OMISSAO = 0;

/** Watts. 0 = por preencher; o tecto cobre impressoras grandes. */
export const POTENCIA_MIN = 0;
export const POTENCIA_MAX = 3000;
export const POTENCIA_OMISSAO = 0;

interface Limites {
  min: number;
  max: number;
  omissao: number;
}

/**
 * Aceita número ou texto com vírgula decimal. Fora do intervalo, NaN ou lixo
 * caem no valor actual (por omissão, o de omissão).
 */
export const normalizarDecimal = (
  valor: unknown,
  { min, max, omissao }: Limites,
  actual: number = omissao
): number => {
  const numero =
    typeof valor === 'string'
      ? Number(valor.replace(',', '.').replace(/[^0-9.]/g, ''))
      : valor;

  if (typeof numero !== 'number' || !Number.isFinite(numero)) return actual;
  if (numero < min || numero > max) return actual;
  // Duas casas chegam para €/kWh e para watts inteiros.
  return Math.round(numero * 100) / 100;
};

const lerNumero = async (chave: string, limites: Limites): Promise<number> => {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    if (bruto === null) return limites.omissao;
    return normalizarDecimal(bruto, limites);
  } catch (erro) {
    log('preferência indisponível', erro);
    return limites.omissao;
  }
};

const guardarNumero = async (
  chave: string,
  valor: number,
  limites: Limites
): Promise<number> => {
  const limpo = normalizarDecimal(valor, limites);
  try {
    await AsyncStorage.setItem(chave, String(limpo));
  } catch (erro) {
    log('não foi possível guardar a preferência', erro);
  }
  return limpo;
};

export const lerPrecoKwh = (): Promise<number> =>
  lerNumero(CHAVE_PRECO_KWH, {
    min: KWH_MIN,
    max: KWH_MAX,
    omissao: KWH_OMISSAO,
  });

export const guardarPrecoKwh = (valor: number): Promise<number> =>
  guardarNumero(CHAVE_PRECO_KWH, valor, {
    min: KWH_MIN,
    max: KWH_MAX,
    omissao: KWH_OMISSAO,
  });

export const lerPotenciaW = (): Promise<number> =>
  lerNumero(CHAVE_POTENCIA_W, {
    min: POTENCIA_MIN,
    max: POTENCIA_MAX,
    omissao: POTENCIA_OMISSAO,
  });

export const guardarPotenciaW = (valor: number): Promise<number> =>
  guardarNumero(CHAVE_POTENCIA_W, valor, {
    min: POTENCIA_MIN,
    max: POTENCIA_MAX,
    omissao: POTENCIA_OMISSAO,
  });

/**
 * Preferências que uma cópia de segurança pode trazer. Campos ausentes ou
 * inválidos ficam de fora — a importação só mexe no que reconhece.
 */
export interface PreferenciasBackup {
  statusIntervalMs?: number;
  filaAuto?: boolean;
  limiteQuaseNoFim?: number;
  precoKwh?: number;
  potenciaW?: number;
}

const INTERVALOS_ACEITES = [30000, 31000, 60000, 120000, 300000];

export const lerPreferenciasDeBackup = (
  bruto: Record<string, unknown>
): PreferenciasBackup => {
  const saida: PreferenciasBackup = {};

  if (
    typeof bruto.statusIntervalMs === 'number' &&
    INTERVALOS_ACEITES.includes(bruto.statusIntervalMs)
  ) {
    saida.statusIntervalMs = bruto.statusIntervalMs;
  }
  if (typeof bruto.filaAuto === 'boolean') saida.filaAuto = bruto.filaAuto;

  const limite = bruto.limiteQuaseNoFim;
  if (typeof limite === 'number' && limite >= 1 && limite <= 50) {
    saida.limiteQuaseNoFim = Math.round(limite);
  }

  const kwh = normalizarDecimal(
    bruto.precoKwh,
    { min: KWH_MIN, max: KWH_MAX, omissao: -1 },
    -1
  );
  if (kwh >= 0) saida.precoKwh = kwh;

  const potencia = normalizarDecimal(
    bruto.potenciaW,
    { min: POTENCIA_MIN, max: POTENCIA_MAX, omissao: -1 },
    -1
  );
  if (potencia >= 0) saida.potenciaW = potencia;

  return saida;
};

/**
 * Custo energético em euros para uma duração em horas.
 * Sem preço ou sem potência devolve 0: quem mostra decide escrever «—».
 */
export const custoEnergetico = (
  horas: number,
  potenciaW: number,
  precoKwh: number
): number => {
  if (!(horas > 0) || !(potenciaW > 0) || !(precoKwh > 0)) return 0;
  const kwh = (potenciaW / 1000) * horas;
  return Math.round(kwh * precoKwh * 100) / 100;
};
