/**
 * Definições de tipos puras do protocolo SDCP (Elegoo Centauri Carbon & Saturn 3 Ultra).
 * Camada agnóstica sem dependências de React Native.
 */

export type PrinterKind = 'fdm' | 'resin';

export interface SdcpHeader {
  Cmd: number;
  RequestID?: string;
  MainboardID?: string;
  TimeStamp?: number;
  From?: number;
}

export interface SdcpCommand<T = unknown> {
  Id: string;
  Data: {
    Cmd: number;
    Data: T;
    RequestID?: string;
    MainboardID?: string;
    TimeStamp?: number;
    From?: number;
  };
}

export interface SdcpResponseData<T = unknown> {
  Cmd: number;
  Data: T;
  Ack?: number;
  RequestID?: string;
  MainboardID?: string;
  TimeStamp?: number;
}

export interface SdcpResponse<T = unknown> {
  Id: string;
  Data: SdcpResponseData<T>;
}

export interface SdcpStatusInfo {
  Status: number;
  CurrentLayer?: number;
  TotalLayer?: number;
  CurrentTicks?: number;
  TotalTicks?: number;
  Filename?: string;
  Progress?: number;
  ErrorNumber?: number;
}

export type EstadoLogico =
  | 'idle'
  | 'preparing'
  | 'heating'
  | 'leveling'
  | 'printing'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'stopped'
  | 'error';
