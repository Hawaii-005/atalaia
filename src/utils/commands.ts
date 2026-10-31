// Construtores de comandos do protocolo SDCP (Elegoo Centauri Carbon).
// Os payloads reproduzem apenas os campos confirmados contra a impressora.
import { CommandValidationError } from './errors';

export type Binario = 0 | 1;

// Envelope comum a todos os comandos enviados por WebSocket.
export interface SdcpCommand<T = unknown> {
  Id: string;
  Data: {
    Cmd: number;
    Data: T;
    RequestID: string;
    MainboardID: string;
    TimeStamp: number;
    From: 1;
  };
}

// Opções de emissão comuns (Id e MainboardID na envolvente).
export interface Emissao {
  id?: string;
  mainboardId?: string;
}

// Mensagens em português para o Ack devolvido em Data.Data.Ack.
export const ACK_MESSAGES: Record<number, string> = {
  0: 'Comando aceite pela impressora.',
  1: 'A impressora está ocupada.',
  2: 'O ficheiro não existe na impressora.',
  3: 'O MD5 do ficheiro não confere.',
  4: 'A impressora não conseguiu abrir o ficheiro.',
  5: 'Resolução inválida para esta impressora.',
  6: 'Formato de ficheiro desconhecido.',
  7: 'Modelo desconhecido.',
};

// Descreve o Ack; cobertura extra para códigos desconhecidos.
export const descreverAck = (ack: number): string =>
  ACK_MESSAGES[ack] ?? `Erro desconhecido na impressora (código ${ack}).`;

// Extrai o Ack de uma resposta de request(); devolve null se não existir.
export const ackDaResposta = (resposta: unknown): number | null => {
  const ack = (resposta as { Ack?: unknown } | null | undefined)?.Ack;
  return typeof ack === 'number' && Number.isFinite(ack) ? ack : null;
};

// ---------- validação de campos ----------

// String não vazia. NÃO normaliza o caminho: o `name` do Cmd 258 é enviado
// tal e qual (ex.: "/local//peca.gcode"), porque é isso que a impressora espera.
const caminhoValido = (valor: unknown, campo: string): string => {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new CommandValidationError(`${campo} é obrigatório.`);
  }
  return valor;
};

// Número finito (NaN/Infinity fora).
const numeroValido = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new CommandValidationError(
      `${campo} tem de ser um número válido (recebido: ${String(valor)}).`
    );
  }
  return valor;
};

// Tem de ser 0 ou 1 (união estrita, não number genérico).
const binarioValido = (valor: unknown, campo: string): Binario => {
  if (valor !== 0 && valor !== 1) {
    throw new CommandValidationError(`${campo} só aceita 0 ou 1.`);
  }
  return valor;
};

// Booleans viram o binário esperado pelo protocolo; não-boolean é erro.
const booleanoParaBinario = (valor: unknown, campo: string): Binario => {
  if (typeof valor !== 'boolean') {
    throw new CommandValidationError(
      `${campo} tem de ser verdadeiro ou falso.`
    );
  }
  return valor ? 1 : 0;
};

// ---------- envolvente ----------

const construir = <T>(
  cmd: number,
  payload: T,
  opts: Emissao = {},
  requestId: string
): SdcpCommand<T> => ({
  Id: opts.id ?? '',
  Data: {
    Cmd: cmd,
    Data: payload,
    RequestID: requestId,
    MainboardID: opts.mainboardId ?? '',
    TimeStamp: Date.now(),
    From: 1,
  },
});

/**
 * Verifica a forma do envelope SDCP sem tocar na rede.
 * Serve de guard para request()/sendCommand().
 */
export const isSdcpCommand = (
  comando: unknown
): comando is SdcpCommand<unknown> => {
  if (typeof comando !== 'object' || comando === null) return false;
  const data = (comando as SdcpCommand).Data;
  if (typeof data !== 'object' || data === null) return false;
  return (
    typeof (comando as SdcpCommand).Id === 'string' &&
    typeof data.Cmd === 'number' &&
    data.Data !== undefined &&
    typeof data.RequestID === 'string' &&
    typeof data.MainboardID === 'string' &&
    typeof data.TimeStamp === 'number' &&
    typeof data.From === 'number'
  );
};

// ---------- Cmd 0 e 1 ----------

/** Estado da impressora ({ Cmd: 0, Data: {} }). */
export const statusCommand = (opts: Emissao = {}): SdcpCommand<{}> =>
  construir(0, {}, opts, `status-${Date.now()}`);

/** Atributos da impressora ({ Cmd: 1, Data: {} }). */
export const attributesCommand = (opts: Emissao = {}): SdcpCommand<{}> =>
  construir(1, {}, opts, `attributes-${Date.now()}`);

// ---------- Cmd 128: começar impressão ----------

// ---------- Cmd 260: detalhe de um ficheiro ----------

export interface FileDetailPayload {
  Url: string;
}

/**
 * Detalhe de um ficheiro: tempo e peso estimados, camadas e ColorMapping
 * (cor pedida pelo G-code -> tray sugerida). É o que a UI oficial usa.
 */
export const fileDetailCommand = (
  url: string,
  opts: Emissao = {}
): SdcpCommand<FileDetailPayload> =>
  construir(
    260,
    { Url: caminhoValido(url, 'Url') },
    opts,
    `detail-${Date.now()}`
  );

export interface StartPrintOptions {
  /** Nivelar a mesa antes de imprimir (Calibration_switch). */
  nivelar: boolean;
  /** Lado da plataforma: 0 = texturizado (A), 1 = liso (B). */
  lado: Binario;
  /** Primeira camada a imprimir (StartLayer). Por omissão 0. */
  camadaInicial?: number;
  /** Ativar time-lapse durante a impressão (Tlp_Switch). Por omissão 0. */
  timelapse?: Binario;
  /** Mapa de slots. Por omissão []. */
  slotMap?: unknown[];
}

export interface StartPrintPayload {
  Filename: string;
  StartLayer: number;
  Calibration_switch: Binario;
  PrintPlatformType: Binario;
  Tlp_Switch: Binario;
  slot_map: unknown[];
}

/**
 * Começa uma impressão. TODOS os seis campos vão na mensagem — enviar só
 * Filename/StartLayer deixou o firmware da impressora em baixo.
 */
export const startPrintCommand = (
  filename: string,
  opcoes: StartPrintOptions,
  opts: Emissao = {}
): SdcpCommand<StartPrintPayload> => {
  if (typeof opcoes !== 'object' || opcoes === null) {
    throw new CommandValidationError(
      'startPrintCommand precisa de opções (nivelar, lado).'
    );
  }
  if (
    !('nivelar' in opcoes) ||
    typeof (opcoes as StartPrintOptions).nivelar !== 'boolean'
  ) {
    throw new CommandValidationError('nivelar tem de ser verdadeiro ou falso.');
  }
  const lado = binarioValido(opcoes.lado, 'lado');
  const camada =
    opcoes.camadaInicial === undefined
      ? 0
      : Math.trunc(numeroValido(opcoes.camadaInicial, 'StartLayer'));
  if (camada < 0) {
    throw new CommandValidationError('StartLayer não pode ser negativo.');
  }
  const timelapse = binarioValido(opcoes.timelapse ?? 0, 'Tlp_Switch');
  if (!Array.isArray(opcoes.slotMap ?? [])) {
    throw new CommandValidationError('slot_map tem de ser uma lista.');
  }

  return construir(
    128,
    {
      Filename: caminhoValido(filename, 'Filename'),
      StartLayer: camada,
      Calibration_switch: booleanoParaBinario(
        opcoes.nivelar,
        'Calibration_switch'
      ),
      PrintPlatformType: lado,
      Tlp_Switch: timelapse,
      slot_map: opcoes.slotMap ?? [],
    },
    opts,
    `start-${Date.now()}`
  );
};

// ---------- Cmd 129/130/131/132/133: controlo de impressão ----------

/** Pausa a impressão. */
export const pausePrintCommand = (opts: Emissao = {}): SdcpCommand<{}> =>
  construir(129, {}, opts, `pause-${Date.now()}`);

/** Para a impressão. */
export const stopPrintCommand = (opts: Emissao = {}): SdcpCommand<{}> =>
  construir(130, {}, opts, `stop-${Date.now()}`);

/** Retoma a impressão de uma pausa. */
export const resumePrintCommand = (opts: Emissao = {}): SdcpCommand<{}> =>
  construir(131, {}, opts, `resume-${Date.now()}`);

// ---------- Cmd 258: listar ficheiros ----------

export interface ListFilesPayload {
  Url: string;
  Page: number;
  Limit: number;
}

export const listFilesCommand = (
  url = '/local/',
  page = 1,
  limit = 100,
  opts: Emissao = {}
): SdcpCommand<ListFilesPayload> => {
  if (!Number.isInteger(numeroValido(page, 'Page')) || page < 1) {
    throw new CommandValidationError('Page tem de ser um inteiro maior que 0.');
  }
  if (!Number.isInteger(numeroValido(limit, 'Limit')) || limit < 1) {
    throw new CommandValidationError(
      'Limit tem de ser um inteiro maior que 0.'
    );
  }
  return construir(
    258,
    { Url: caminhoValido(url, 'Url'), Page: page, Limit: limit },
    opts,
    `files-${page}-${Date.now()}`
  );
};

// ---------- Cmd 259: apagar ficheiros/pastas ----------

export interface DeleteFilesPayload {
  FileList: string[];
  FolderList: string[];
}

export const deleteFilesCommand = (
  ficheiros: string[],
  pastas: string[] = [],
  opts: Emissao = {}
): SdcpCommand<DeleteFilesPayload> => {
  if (!Array.isArray(ficheiros) || ficheiros.length === 0) {
    throw new CommandValidationError(
      'FileList precisa de, pelo menos, um ficheiro.'
    );
  }
  if (!Array.isArray(pastas)) {
    throw new CommandValidationError('FolderList tem de ser uma lista.');
  }
  return construir(
    259,
    {
      FileList: ficheiros.map((nome, i) =>
        caminhoValido(nome, `FileList[${i}]`)
      ),
      FolderList: pastas.map((nome, i) =>
        caminhoValido(nome, `FolderList[${i}]`)
      ),
    },
    opts,
    `delete-${Date.now()}`
  );
};

// ---------- Cmd 320/321: histórico de impressões ----------

/** Histórico: sem paginação devolve {}; com paginação devolve { Page, Limit }. */
export const printHistoryCommand = (
  page?: number,
  limit?: number,
  opts: Emissao = {}
): SdcpCommand<{} | { Page: number; Limit: number }> => {
  if (page === undefined && limit === undefined) {
    return construir(320, {}, opts, `history-${Date.now()}`);
  }
  if (page === undefined || limit === undefined) {
    throw new CommandValidationError('Page e Limit têm de vir juntos.');
  }
  if (!Number.isInteger(numeroValido(page, 'Page')) || page < 1) {
    throw new CommandValidationError('Page tem de ser um inteiro maior que 0.');
  }
  if (!Number.isInteger(numeroValido(limit, 'Limit')) || limit < 1) {
    throw new CommandValidationError(
      'Limit tem de ser um inteiro maior que 0.'
    );
  }
  return construir(
    320,
    { Page: page, Limit: limit },
    opts,
    `history-${page}-${Date.now()}`
  );
};

export interface HistoryDetailPayload {
  Id: string[];
}

export const printHistoryDetailCommand = (
  ids: string[],
  opts: Emissao = {}
): SdcpCommand<HistoryDetailPayload> => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new CommandValidationError('Id precisa de, pelo menos, um ID.');
  }
  if (ids.some(id => typeof id !== 'string' || id.trim() === '')) {
    throw new CommandValidationError('Id só aceita identificadores válidos.');
  }
  return construir(321, { Id: ids }, opts, `history-detail-${Date.now()}`);
};

// ---------- Cmd 386: vídeo ----------

export const videoCommand = (
  ligar: boolean,
  opts: Emissao = {}
): SdcpCommand<{ Enable: Binario }> => {
  if (typeof ligar !== 'boolean') {
    throw new CommandValidationError('Enable tem de ser verdadeiro ou falso.');
  }
  return construir(386, { Enable: ligar ? 1 : 0 }, opts, `video-${Date.now()}`);
};

// ---------- Cmd 387: time-lapse ----------

export const timelapseCommand = (
  ligar: boolean,
  opts: Emissao = {}
): SdcpCommand<{ Enable: Binario }> => {
  if (typeof ligar !== 'boolean') {
    throw new CommandValidationError('Enable tem de ser verdadeiro ou falso.');
  }
  return construir(
    387,
    { Enable: ligar ? 1 : 0 },
    opts,
    `timelapse-${Date.now()}`
  );
};

// ---------- Cmd 403: luz e velocidade ----------

export const lightCommand = (
  ligada: boolean,
  opts: Emissao = {}
): SdcpCommand<{ LightStatus: { SecondLight: Binario } }> => {
  if (typeof ligada !== 'boolean') {
    throw new CommandValidationError(
      'SecondLight só aceita luz ligada (1) ou desligada (0).'
    );
  }
  return construir(
    403,
    { LightStatus: { SecondLight: ligada ? 1 : 0 } },
    opts,
    `light-${Date.now()}`
  );
};

export const printSpeedCommand = (
  percentagem: number,
  opts: Emissao = {}
): SdcpCommand<{ PrintSpeedPct: number }> => {
  const pct = numeroValido(percentagem, 'PrintSpeedPct');
  if (!Number.isInteger(pct) || pct < 1 || pct > 500) {
    throw new CommandValidationError(
      'PrintSpeedPct tem de ser uma percentagem inteira entre 1 e 500.'
    );
  }
  return construir(
    403,
    { PrintSpeedPct: pct },
    opts,
    `speed-${pct}-${Date.now()}`
  );
};

export const fanCommand = (
  ventoinhas: { model: number; side: number; chamber: number },
  opts: Emissao = {}
): SdcpCommand<{
  TargetFanSpeed: { ModelFan: number; AuxiliaryFan: number; BoxFan: number };
}> => {
  const limpar = (valor: number, nome: string) => {
    const n = numeroValido(valor, nome);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      throw new CommandValidationError(
        `${nome} tem de ser uma percentagem inteira entre 0 e 100.`
      );
    }
    return n;
  };
  return construir(
    403,
    {
      TargetFanSpeed: {
        ModelFan: limpar(ventoinhas.model, 'ModelFan'),
        AuxiliaryFan: limpar(ventoinhas.side, 'AuxiliaryFan'),
        BoxFan: limpar(ventoinhas.chamber, 'BoxFan'),
      },
    },
    opts,
    `fan-${Date.now()}`
  );
};

export const temperatureCommand = (
  alvos: { nozzle?: number; bed?: number; chamber?: number },
  opts: Emissao = {}
): SdcpCommand<{
  TempTargetNozzle?: number;
  TempTargetHotbed?: number;
  TempTargetBox?: number;
}> => {
  const limites: [keyof typeof alvos, number, number][] = [
    ['nozzle', 0, 300],
    ['bed', 0, 110],
    ['chamber', 0, 60],
  ];
  const dados: Record<string, number> = {};
  for (const [campo, minimo, maximo] of limites) {
    const valor = alvos[campo];
    if (valor === undefined) continue;
    if (
      typeof valor !== 'number' ||
      Number.isNaN(valor) ||
      valor < minimo ||
      valor > maximo
    ) {
      throw new CommandValidationError(
        `${campo} tem de estar entre ${minimo} e ${maximo} °C.`
      );
    }
    dados[
      campo === 'nozzle'
        ? 'TempTargetNozzle'
        : campo === 'bed'
          ? 'TempTargetHotbed'
          : 'TempTargetBox'
    ] = valor;
  }
  if (Object.keys(dados).length === 0) {
    throw new CommandValidationError('Nenhuma temperatura indicada.');
  }
  return construir(403, dados, opts, `temp-${Date.now()}`);
};

// ---------- Cmd 324: slots do Canvas ----------
// Confirmado na impressora: devolve canvas_list com tray_list (marca, tipo,
// cor em hex e temperaturas aceites). NÃO traz gramas por rolo.

export interface CanvasTray {
  tray_id: number;
  brand: string;
  filament_type: string;
  filament_name: string;
  filament_code: string;
  /** Cor em hex, como a impressora a reporta (ex.: "#077747"). */
  filament_color: string;
  min_nozzle_temp: number;
  max_nozzle_temp: number;
  status: number;
}

export interface CanvasLista {
  canvas_id: number;
  connected: number;
  tray_list: CanvasTray[];
}

export interface CanvasSlots {
  active_canvas_id: number;
  active_tray_id: number;
  auto_refill: number;
  canvas_list: CanvasLista[];
}

/** Lê os slots do sistema de filamento (Canvas). */
/** Mover um eixo (Cmd 401). `passo` é a distância em mm; o sinal dá o sentido. */
/** Pedir os URLs do vídeo de um trabalho (Cmd 323). */
export const historyVideoCommand = (
  url: string,
  opts: Emissao = {}
): SdcpCommand<{ Url: string }> =>
  construir(323, { Url: url }, opts, `video-${Date.now()}`);

export const jogCommand = (
  eixo: 'X' | 'Y' | 'Z',
  passo: number,
  opts: Emissao = {}
): SdcpCommand<{}> =>
  construir(
    401,
    { Axis: eixo, Step: passo },
    opts,
    `jog-${eixo}-${Date.now()}`
  );

/** Levar os eixos à origem (Cmd 402): 'XYZ' ou 'Z'. */
export const homeCommand = (
  eixo: 'XYZ' | 'X' | 'Y' | 'Z',
  opts: Emissao = {}
): SdcpCommand<{}> =>
  construir(402, { Axis: eixo }, opts, `home-${eixo}-${Date.now()}`);

export const canvasSlotsCommand = (opts: Emissao = {}): SdcpCommand<{}> =>
  construir(324, {}, opts, `canvas-${Date.now()}`);
