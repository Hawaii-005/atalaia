import { NativeModules } from 'react-native';

/**
 * Ponte para o motor de fatiamento nativo.
 *
 * O módulo `Fatiador` só existe na edição `completa` (AGPL). Na `lite` o
 * `NativeModules.Fatiador` é `undefined` e todas as funções devolvem
 * `disponivel: false` — a UI esconde o fatiador em vez de falhar.
 */

type ModuloNativo = {
  inicializar: () => Promise<boolean>;
  versao: () => Promise<string>;
  perfis: () => Promise<{
    impressoras: string[];
    filamentos: string[];
    processos: string[];
  }>;
  selecionarImpressora: (nome: string) => Promise<boolean>;
  prepararModelo: (uri: string, nome: string) => Promise<string>;
  fatiar: (
    modelo: string,
    impressora: string,
    filamento: string,
    processo: string
  ) => Promise<{
    sucesso: boolean;
    gcode: string;
    bytes: number;
    erro: string;
  }>;
  progresso: () => Promise<{
    passo: number;
    etapa: string;
    percentagem: number;
  }>;
  cancelar: () => Promise<boolean>;
  erro: () => Promise<string>;
};

const modulo = (): ModuloNativo | undefined =>
  NativeModules.Fatiador as ModuloNativo | undefined;

/** O motor está neste APK? (edição `completa`) */
export const fatiadorDisponivel = (): boolean => !!modulo()?.fatiar;

export type Perfis = {
  impressoras: string[];
  filamentos: string[];
  processos: string[];
};

export const inicializar = async (): Promise<boolean> => {
  const m = modulo();
  if (!m) return false;
  try {
    return await m.inicializar();
  } catch {
    return false;
  }
};

export const versao = async (): Promise<string> => {
  try {
    return (await modulo()?.versao()) ?? '';
  } catch {
    return '';
  }
};

export const perfis = async (): Promise<Perfis> => {
  try {
    const r = await modulo()?.perfis();
    return {
      impressoras: r?.impressoras ?? [],
      filamentos: r?.filamentos ?? [],
      processos: r?.processos ?? [],
    };
  } catch {
    return { impressoras: [], filamentos: [], processos: [] };
  }
};

/**
 * Muda a impressora activa no motor, para que `perfis()` devolva os filamentos
 * e processos compatíveis com a máquina que o utilizador escolheu.
 */
export const selecionarImpressora = async (nome: string): Promise<boolean> => {
  try {
    return (await modulo()?.selecionarImpressora(nome)) ?? false;
  } catch {
    return false;
  }
};

/** Copia o modelo para a pasta de trabalho do motor e devolve o caminho. */
export const prepararModelo = async (
  uri: string,
  nome: string
): Promise<string> => {
  const m = modulo();
  if (!m) throw new Error('fatiador_indisponivel');
  // O módulo nativo aceita caminho ou file://; normalizar aqui evita
  // duplicar a regra em cada chamada.
  const caminho = uri.replace(/^file:\/\//, '');
  return m.prepararModelo(caminho, nome);
};

export type ResultadoFatiamento = {
  sucesso: boolean;
  gcode: string;
  bytes: number;
  erro: string;
};

export const fatiar = async (
  modelo: string,
  perfil: { impressora: string; filamento: string; processo: string }
): Promise<ResultadoFatiamento> => {
  const m = modulo();
  if (!m) {
    return {
      sucesso: false,
      gcode: '',
      bytes: 0,
      erro: 'fatiador_indisponivel',
    };
  }
  return m.fatiar(modelo, perfil.impressora, perfil.filamento, perfil.processo);
};

export const progresso = async () => {
  try {
    return (
      (await modulo()?.progresso()) ?? {
        passo: 0,
        etapa: '',
        percentagem: 0,
      }
    );
  } catch {
    return { passo: 0, etapa: '', percentagem: 0 };
  }
};

export const cancelar = async (): Promise<void> => {
  try {
    await modulo()?.cancelar();
  } catch {
    // cancelar é best-effort: o motor pode já ter terminado
  }
};
