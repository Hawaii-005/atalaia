import { PrinterKind, SdcpCommand, SdcpResponse, EstadoLogico } from '../types';
import { Capabilities, FirmwareFlavor } from '../../types';

export interface PrinterDriverOptions {
  id: string;
  name: string;
  ipAddress: string;
  mainboardId?: string;
  alternateIp?: string;
}

export interface PrinterDriverStatus {
  connected: boolean;
  estadoLogico: EstadoLogico;
  rawStatus: number;
  progress: number;
  filename?: string;
  currentLayer?: number;
  totalLayer?: number;
  tempNozzle?: number;
  targetNozzle?: number;
  tempBed?: number;
  targetBed?: number;
}

export interface PrinterDriver {
  readonly id: string;
  readonly name: string;
  readonly ipAddress: string;
  readonly kind: PrinterKind;
  readonly firmware: FirmwareFlavor;
  readonly capabilities: Capabilities;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendCommand<T>(
    command: SdcpCommand<T>,
    timeoutMs?: number
  ): Promise<SdcpResponse<T>>;
  getStatus(): PrinterDriverStatus;
  onStatusChange(listener: (status: PrinterDriverStatus) => void): () => void;
}
