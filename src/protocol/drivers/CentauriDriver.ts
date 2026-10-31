import {
  PrinterDriver,
  PrinterDriverOptions,
  PrinterDriverStatus,
} from './PrinterDriver';
import { PrinterKind, SdcpCommand, SdcpResponse } from '../types';
import { calcularEstadoLogico } from '../stateMachine';
import { parseEValidarSdcp } from '../schemas';

export class CentauriDriver implements PrinterDriver {
  readonly id: string;
  readonly name: string;
  readonly ipAddress: string;
  readonly kind: PrinterKind = 'fdm';

  private socket: WebSocket | null = null;
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
    if (this.socket) return;
    const url = `ws://${this.ipAddress}:3030/websocket`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.status.connected = true;
      this.notificarListeners();
    };

    this.socket.onmessage = event => {
      const msg = parseEValidarSdcp(event.data);
      if (!msg) return;
      if (msg.Data.Cmd === 0) {
        const d = msg.Data.Data as any;
        const printInfo = d?.PrintInfo ?? {};
        this.status = {
          connected: true,
          estadoLogico: calcularEstadoLogico({
            statusCode: printInfo.Status ?? 0,
            tempNozzle: d?.TempOfNozzle,
            tempTargetNozzle: d?.TempTargetNozzle,
            tempBed: d?.TempOfHotbed,
            tempTargetBed: d?.TempTargetHotbed,
            isResin: false,
          }),
          rawStatus: printInfo.Status ?? 0,
          progress: printInfo.Progress ?? 0,
          filename: printInfo.Filename,
          currentLayer: printInfo.CurrentLayer,
          totalLayer: printInfo.TotalLayer,
          tempNozzle: d?.TempOfNozzle,
          targetNozzle: d?.TempTargetNozzle,
          tempBed: d?.TempOfHotbed,
          targetBed: d?.TempTargetHotbed,
        };
        this.notificarListeners();
      }
    };

    this.socket.onclose = () => {
      this.status.connected = false;
      this.socket = null;
      this.notificarListeners();
    };
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.status.connected = false;
    this.notificarListeners();
  }

  async sendCommand<T>(command: SdcpCommand<T>): Promise<SdcpResponse<T>> {
    if (!this.socket || !this.status.connected) {
      throw new Error(`CentauriDriver: não ligado a ${this.ipAddress}`);
    }
    this.socket.send(JSON.stringify(command));
    return {
      Id: command.Id,
      Data: { Cmd: command.Data.Cmd, Data: {} as T, Ack: 0 },
    };
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
