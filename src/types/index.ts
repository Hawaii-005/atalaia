// Common types used throughout the app

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface NavigationProps {
  navigation: any;
  route: any;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

// Printer types
export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'
  | 'timeout';

export interface CurrentFanSpeed {
  ModelFan: number;
  AuxiliaryFan: number;
  BoxFan: number;
}

export interface LightStatus {
  SecondLight: number;
  RgbLight: [number, number, number];
}

export interface PrintInfo {
  Status: number;
  CurrentLayer: number;
  TotalLayer: number;
  CurrentTicks: number;
  TotalTicks: number;
  Filename: string;
  TaskId: string;
  PrintSpeedPct: number;
  Progress: number;
  /** Só a resina preenche: 0 = sem erro, 4 = ficheiro inválido/corrompido. */
  ErrorNumber?: number;
}

export type PrintStatus =
  | 'idle'
  | 'completed'
  | 'preparing'
  | 'printing'
  | 'paused'
  | 'stopped'
  | 'unknown';

// Códigos lidos da Centauri Carbon (firmware 1.4.49):
// 0 parada · 1/16/20 preparação (o 20 também aparece em pausa) · 13 arranque
// de camada · 5 transição · 6 a imprimir · 7 a parar · 8 parada (mantém
// Progress antigo) · 9 terminada.
// A pausa NÃO tem código próprio: mantém o 6 e o CurrentTicks é que pára.
export const getPrintStatus = (status: number): PrintStatus => {
  switch (status) {
    case 0:
      return 'idle';
    case 1:
    case 16:
    case 20:
      return 'preparing';
    case 5:
    case 6:
    case 13:
      return 'printing';
    case 7:
    case 8:
      return 'stopped';
    case 9:
      return 'completed';
    default:
      return 'unknown';
  }
};

/** Estado real, juntando o código da máquina e o sinal de ticks parados. */
export const classificarEstado = (
  printInfo: PrintInfo | undefined,
  ticksParados: boolean
): PrintStatus => {
  if (!printInfo?.Filename) {
    return printInfo?.Status === 7 || printInfo?.Status === 8
      ? 'stopped'
      : 'idle';
  }
  if (ticksParados) {
    const base = getPrintStatus(printInfo.Status);
    if (base === 'printing' || base === 'preparing') return 'paused';
  }
  return getPrintStatus(printInfo.Status);
};

/** Dá para pausar enquanto está a imprimir. */
export const isPausable = (status: number): boolean =>
  status === 6 || status === 13;

/** Retomar só no estado de pausa (20). Em 6/13 a máquina está a imprimir. */
export const isResumable = (status: number): boolean => status === 20;

/** Qualquer trabalho em curso pode ser parado. */
export const isStoppable = (status: number): boolean =>
  status === 1 || status === 6 || status === 13 || status === 16 || status === 20;

export interface PrinterStatus {
  CurrentStatus: number[];
  TimeLapseStatus: number;
  PlatFormType: number;
  TempOfHotbed: number;
  TempOfNozzle: number;
  TempOfBox: number;
  TempTargetHotbed: number;
  TempTargetNozzle: number;
  TempTargetBox: number;
  CurrenCoord: string;
  CurrentFanSpeed: CurrentFanSpeed;
  ZOffset: number;
  LightStatus: LightStatus;
  PrintInfo: PrintInfo;
}

/** 'fdm' = Centauri (WebSocket SDCP) · 'resin' = Saturn/Mars (SDCP V1 MQTT). */
export type PrinterKind = 'fdm' | 'resin';

export interface Printer {
  id: string;
  printerName: string;
  ipAddress: string;
  kind?: PrinterKind;
  /** Id da sessão UDP da impressora de resina (campo `Id` do SDCP V1). */
  sdcpId?: string;
  connectionStatus: ConnectionStatus;
  status?: PrinterStatus;
  lastUpdate?: number; // Timestamp of last status update
  videoUrl?: string; // Video stream URL
  mainboardId?: string; // Stable hardware id, used to find the printer after its IP changes
  alternateIp?: string; // Endereço alternativo (ex.: via Tailscale, fora de casa)
  activeIp?: string; // Endereço que está a funcionar agora (LAN ou alternativo)
  reconnectAttempt?: number; // Tentativa actual de reconexão (presente só a reconectar)
}
