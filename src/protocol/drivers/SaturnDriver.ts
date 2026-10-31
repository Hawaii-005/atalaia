import {
  PrinterDriver,
  PrinterDriverOptions,
  PrinterDriverStatus,
} from './PrinterDriver';
import { PrinterKind, SdcpCommand, SdcpResponse } from '../types';
import { calcularEstadoLogico } from '../stateMachine';

export class SaturnDriver implements PrinterDriver {
  readonly id: string;
  readonly name: string;
  readonly ipAddress: string;
  readonly kind: PrinterKind = 'resin';

  private connected: boolean = false;
  private listeners: Set<(status: PrinterDriverStatus) => void> = new Set();
  private status: PrinterDriverStatus = {
    connected: false,
    estadoLogico: 'idle',
    rawStatus: 0,
    progress: 0,
  };

  constructor(options: PrinterDriverOptions) {
    this.id = options.id;
    this.name = options.name;
    this.ipAddress = options.ipAddress;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.status.connected = true;
    this.notificarListeners();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.status.connected = false;
    this.notificarListeners();
  }

  async sendCommand<T>(command: SdcpCommand<T>): Promise<SdcpResponse<T>> {
    if (!this.connected) {
      throw new Error(`SaturnDriver: não ligado a ${this.ipAddress}`);
    }
    return {
      Id: command.Id,
      Data: { Cmd: command.Data.Cmd, Data: {} as T, Ack: 0 },
    };
  }

  atualizarEstadoRaw(
    rawStatus: number,
    currentStatus: number,
    filename?: string,
    layer?: number,
    totalLayers?: number,
    progress?: number
  ) {
    this.status = {
      connected: this.connected,
      estadoLogico: calcularEstadoLogico({
        statusCode: rawStatus,
        currentStatus,
        isResin: true,
      }),
      rawStatus,
      filename,
      currentLayer: layer,
      totalLayer: totalLayers,
      progress: progress ?? 0,
    };
    this.notificarListeners();
  }

  getStatus(): PrinterDriverStatus {
    return { ...this.status };
  }

  onStatusChange(listener: (status: PrinterDriverStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notificarListeners() {
    this.listeners.forEach(l => l(this.getStatus()));
  }
}
