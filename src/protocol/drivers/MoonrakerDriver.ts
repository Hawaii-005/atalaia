import {
  PrinterDriver,
  PrinterDriverOptions,
  PrinterDriverStatus,
} from './PrinterDriver';
import { SdcpCommand, SdcpResponse, PrinterKind } from '../types';
import { Capabilities, FirmwareFlavor, PrinterStatus } from '../../types';
import { CAPABILITIES_MOONRAKER_COSMOS } from '../capabilities';

export interface MoonrakerKlipperStatus {
  print_stats?: {
    state?: string;
    filename?: string;
    total_duration?: number;
    print_duration?: number;
  };
  display_status?: {
    progress?: number;
    current_layer?: number;
    total_layers?: number;
  };
  extruder?: {
    temperature?: number;
    target?: number;
  };
  heater_bed?: {
    temperature?: number;
    target?: number;
  };
  webhooks?: {
    state?: string;
    state_message?: string;
  };
  fan?: {
    speed?: number;
  };
  output_pin?: {
    value?: number;
  };
  'output_pin caselight'?: {
    value?: number;
  };
  'led case'?: {
    color_data?: number[][];
  };
  AFC?: {
    current_load?: string | null;
    lanes?: string[];
  };
  [key: string]: any;
  gcode_move?: {
    gcode_position?: [number, number, number, number];
    homing_origin?: [number, number, number, number];
    speed_factor?: number;
  };
  toolhead?: {
    position?: [number, number, number, number];
    homed_axes?: string;
  };
}

export class MoonrakerDriver implements PrinterDriver {
  readonly id: string;
  readonly name: string;
  readonly ipAddress: string;
  readonly kind: PrinterKind = 'fdm';
  readonly firmware: FirmwareFlavor = 'moonraker';
  readonly capabilities: Capabilities = CAPABILITIES_MOONRAKER_COSMOS;

  private socket: WebSocket | null = null;
  private listeners: Set<(status: PrinterDriverStatus) => void> = new Set();
  private pendingRequests: Map<
    string | number,
    {
      resolve: (val: any) => void;
      reject: (err: any) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private requestIdCounter = 1;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private isExplicitlyClosed = false;

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
    this.isExplicitlyClosed = false;
    this.clearReconnectTimer();

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const connectionTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.disconnect();
          reject(new Error('Timeout de ligação ao Moonraker'));
        }
      }, 7000);

      try {
        // Suporta tanto a porta padrão do Moonraker (:7125) como proxy reverso na porta 80 (COSMOS oficial)
        const hostComPorta = this.ipAddress.includes(':')
          ? this.ipAddress
          : `${this.ipAddress}`;
        const url = `ws://${hostComPorta}/websocket`;
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(connectionTimer);
          }
          this.reconnectAttempt = 0;
          this.updateStatus({ connected: true });
          this.subscribeKlipperObjects().catch(() => {});
          resolve();
        };

        this.socket.onmessage = (event: WebSocketMessageEvent) => {
          this.handleIncomingMessage(event.data);
        };

        this.socket.onerror = () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(connectionTimer);
            reject(new Error('Erro de ligação WebSocket Moonraker'));
          }
        };

        this.socket.onclose = () => {
          this.cleanupSocket();
          this.updateStatus({ connected: false });
          if (!isSettled) {
            isSettled = true;
            clearTimeout(connectionTimer);
            reject(new Error('Ligação WebSocket terminada pelo servidor'));
          } else if (!this.isExplicitlyClosed) {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(connectionTimer);
        }
        this.updateStatus({ connected: false });
        reject(err);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.isExplicitlyClosed = true;
    this.clearReconnectTimer();
    this.cleanupSocket();
    this.updateStatus({ connected: false });
  }

  getStatus(): PrinterDriverStatus {
    return { ...this.status };
  }

  getAppPrinterStatus(): PrinterStatus {
    const s = this.status;
    let statusCode = 0;
    if (s.estadoLogico === 'printing') statusCode = 6;
    else if (s.estadoLogico === 'paused') statusCode = 20;
    else if (s.estadoLogico === 'completed') statusCode = 9;
    else if (s.estadoLogico === 'stopped' || s.estadoLogico === 'error')
      statusCode = 8;
    else statusCode = 0;

    const coordStr = s.position
      ? `X:${s.position[0].toFixed(2)} Y:${s.position[1].toFixed(2)} Z:${s.position[2].toFixed(2)}`
      : '';
    const fanVal = s.fanSpeed ?? 0;

    return {
      CurrentStatus: [statusCode === 0 ? 0 : 1],
      TimeLapseStatus: 0,
      PlatFormType: 0,
      TempOfHotbed: s.tempBed ?? 0,
      TempOfNozzle: s.tempNozzle ?? 0,
      TempOfBox: 0,
      TempTargetHotbed: s.targetBed ?? 0,
      TempTargetNozzle: s.targetNozzle ?? 0,
      TempTargetBox: 0,
      CurrenCoord: coordStr,
      CurrentFanSpeed: {
        ModelFan: fanVal,
        AuxiliaryFan: s.fanAux ?? 0,
        BoxFan: s.fanBox ?? 0,
      },
      ZOffset: s.zOffset ?? 0,
      LightStatus: {
        SecondLight: s.lightOn ? 1 : 0,
        RgbLight: [0, 0, 0],
      },
      PrintInfo: {
        Status: statusCode,
        CurrentLayer: s.currentLayer ?? 0,
        TotalLayer: s.totalLayer ?? 0,
        CurrentTicks: 0,
        TotalTicks: 0,
        Filename: s.filename ?? '',
        TaskId: '',
        PrintSpeedPct: 100,
        Progress: Math.max(0, Math.min(100, Math.round(s.progress))),
        ErrorNumber: 0,
      },
    };
  }

  onStatusChange(listener: (status: PrinterDriverStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async sendJsonRpc<T = any>(
    method: string,
    params: any = {},
    timeoutMs: number = 5000
  ): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Moonraker não está ligado');
    }

    const id = ++this.requestIdCounter;
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout no comando Moonraker (${method})`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      try {
        this.socket?.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  async sendCommand<T>(
    command: SdcpCommand<T>,
    _timeoutMs?: number
  ): Promise<SdcpResponse<T>> {
    const cmd = command.Data.Cmd;
    const data = command.Data.Data as any;

    try {
      switch (cmd) {
        case 128: {
          // Iniciar impressão
          const filename = data?.Filename || data?.filename || data?.name || '';
          await this.sendJsonRpc('printer.print.start', {
            filename: filename.startsWith('/') ? filename.slice(1) : filename,
          });
          break;
        }
        case 129: {
          // Pausar impressão
          await this.sendJsonRpc('printer.print.pause');
          break;
        }
        case 130: {
          // Cancelar/parar impressão
          await this.sendJsonRpc('printer.print.cancel');
          break;
        }
        case 131: {
          // Retomar impressão
          await this.sendJsonRpc('printer.print.resume');
          break;
        }
        case 258: {
          // Listar ficheiros
          const result = await this.sendJsonRpc('server.files.list', {
            root: 'gcodes',
          });
          const fileList = Array.isArray(result)
            ? result.map((f: any) => {
                const thumbs = f.thumbnails;
                const thumbPath =
                  Array.isArray(thumbs) && thumbs.length > 0
                    ? thumbs[thumbs.length - 1].relative_path
                    : undefined;
                const cleanHost = this.ipAddress.split(':')[0];
                return {
                  name: f.path || f.filename,
                  FileSize: f.size || 0,
                  CreateTime: f.modified || Date.now(),
                  thumbnailUrl: thumbPath
                    ? `http://${cleanHost}/server/files/gcodes/${encodeURI(thumbPath)}`
                    : undefined,
                };
              })
            : [];
          return {
            Id: this.id,
            Data: {
              Cmd: cmd,
              Data: { FileList: fileList } as unknown as T,
              Ack: 0,
            },
          };
        }
        case 259: {
          // Eliminar ficheiros
          const files: string[] = data?.FileList || [];
          for (const f of files) {
            const cleanName = f.startsWith('/') ? f.slice(1) : f;
            await this.sendJsonRpc('server.files.delete_file', {
              path: cleanName.startsWith('gcodes/')
                ? cleanName
                : `gcodes/${cleanName}`,
            });
          }
          break;
        }
        case 324: {
          // Slots do Canvas via módulo AFC (Klipper)
          const afcQuery = await this.sendJsonRpc('printer.objects.query', {
            objects: {
              AFC: null,
              'AFC_lane CANVAS_1': null,
              'AFC_lane CANVAS_2': null,
              'AFC_lane CANVAS_3': null,
              'AFC_lane CANVAS_4': null,
            },
          });

          const status = afcQuery?.status || {};
          const afc = status.AFC;
          const trays = [1, 2, 3, 4].map(idx => {
            const laneKey = `AFC_lane CANVAS_${idx}`;
            const lane = status[laneKey];
            if (!lane) {
              return {
                tray_id: idx - 1,
                brand: '',
                filament_type: '',
                filament_name: '',
                filament_code: '',
                filament_color: '#000000',
                min_nozzle_temp: 190,
                max_nozzle_temp: 230,
                status: 0,
              };
            }
            return {
              tray_id: idx - 1,
              brand: lane.spool_vendor || 'Generic',
              filament_type: lane.material || 'PLA',
              filament_name: lane.filament_name || `Slot ${idx}`,
              filament_code: lane.name || `CANVAS_${idx}`,
              filament_color: lane.color || '#E91E63',
              min_nozzle_temp:
                lane.extruder_temp > 0 ? lane.extruder_temp : 190,
              max_nozzle_temp:
                lane.extruder_temp > 0 ? lane.extruder_temp + 30 : 230,
              status: lane.load ? 1 : 0,
            };
          });

          const canvasSlots = {
            active_canvas_id: 0,
            active_tray_id: afc?.current_load
              ? Math.max(
                  0,
                  parseInt(afc.current_load.replace(/\D/g, ''), 10) - 1
                )
              : 0,
            auto_refill: 0,
            canvas_list: [
              {
                canvas_id: 0,
                connected: 1,
                tray_list: trays,
              },
            ],
          };

          return {
            Id: this.id,
            Data: {
              Cmd: cmd,
              Data: canvasSlots as unknown as T,
              Ack: 0,
            },
          };
        }
        case 401: {
          // Jog / Mover eixos: { Axis: 'X'|'Y'|'Z', Step: mm }
          const axis = String(data?.Axis || '').toUpperCase();
          const step = Number(data?.Step || 0);
          if (axis && step) {
            const feedrate = axis === 'Z' ? 600 : 3000;
            // Modo relativo -> mover -> voltar a absoluto
            const script = `G91\nG1 ${axis}${step} F${feedrate}\nG90`;
            await this.sendJsonRpc('printer.gcode.script', { script });
          }
          break;
        }
        case 402: {
          // Home eixos: { Axis: 'XYZ'|'X'|'Y'|'Z' }
          const axis = String(data?.Axis || '').toUpperCase();
          let gcode = 'G28';
          if (axis === 'X' || axis === 'Y' || axis === 'Z') {
            gcode = `G28 ${axis}`;
          }
          await this.sendJsonRpc('printer.gcode.script', { script: gcode });
          break;
        }
        case 403: {
          // Luz, Velocidade, Ventoinhas ou Temperaturas
          const gcodes: string[] = [];

          // Luz interna (caselight pin ou macro M355)
          if (data?.LightStatus?.SecondLight !== undefined) {
            const on = data.LightStatus.SecondLight === 1;
            // No COSMOS na Centauri Carbon o LED interno é 'led case'
            gcodes.push(
              `SET_LED LED="case" WHITE=${on ? '1.0' : '0.0'} SYNC=0 TRANSMIT=1`
            );
          }

          // Velocidade de impressão (%)
          if (data?.PrintSpeedPct !== undefined) {
            const pct = Number(data.PrintSpeedPct);
            if (pct >= 1 && pct <= 500) {
              gcodes.push(`M220 S${pct}`);
            }
          }

          // Ventoinhas: ModelFan (part cooling), AuxiliaryFan (aux_fan), BoxFan (case_fan)
          if (data?.TargetFanSpeed?.ModelFan !== undefined) {
            const pwm = Math.round(
              (Number(data.TargetFanSpeed.ModelFan) / 100) * 255
            );
            gcodes.push(`M106 S${pwm}`);
          }
          if (data?.TargetFanSpeed?.AuxiliaryFan !== undefined) {
            const spd = Number(data.TargetFanSpeed.AuxiliaryFan) / 100;
            gcodes.push(`SET_FAN_SPEED FAN=aux_fan SPEED=${spd}`);
          }
          if (data?.TargetFanSpeed?.BoxFan !== undefined) {
            const spd = Number(data.TargetFanSpeed.BoxFan) / 100;
            gcodes.push(`SET_FAN_SPEED FAN=case_fan SPEED=${spd}`);
          }

          // Temperaturas: bocal ou mesa
          if (data?.TempTargetNozzle !== undefined) {
            const temp = Number(data.TempTargetNozzle);
            gcodes.push(`M104 S${temp}`);
          }
          if (data?.TempTargetHotbed !== undefined) {
            const temp = Number(data.TempTargetHotbed);
            gcodes.push(`M140 S${temp}`);
          }

          if (gcodes.length > 0) {
            await this.sendJsonRpc('printer.gcode.script', {
              script: gcodes.join('\n'),
            });
          }
          break;
        }
        default:
          break;
      }
    } catch (err: any) {
      return {
        Id: this.id,
        Data: {
          Cmd: cmd,
          Data: {} as T,
          Ack: 1,
          Description: err?.message || 'Erro ao executar comando Moonraker',
        },
      };
    }

    // Compatibilidade com a interface agnóstica PrinterDriver
    return {
      Id: this.id,
      Data: {
        Cmd: command.Data.Cmd,
        Data: {} as T,
        Ack: 0,
      },
    };
  }

  private async subscribeKlipperObjects(): Promise<void> {
    try {
      const response = await this.sendJsonRpc('printer.objects.subscribe', {
        objects: {
          print_stats: null,
          display_status: null,
          extruder: null,
          heater_bed: null,
          webhooks: null,
          fan: null,
          'fan_generic aux_fan': null,
          'fan_generic case_fan': null,
          'output_pin caselight': null,
          'led case': null,
          AFC: null,
          'AFC_lane CANVAS_1': null,
          'AFC_lane CANVAS_2': null,
          'AFC_lane CANVAS_3': null,
          'AFC_lane CANVAS_4': null,
          gcode_move: null,
          toolhead: null,
        },
      });

      if (response?.status) {
        this.processKlipperStatusUpdate(response.status);
      }
    } catch {
      // Falha ao subscrever tratada silenciosamente
    }
  }

  private handleIncomingMessage(rawData: any): void {
    try {
      const message = JSON.parse(String(rawData));
      if (!message || typeof message !== 'object') return;

      // Resposta a RPC com ID pendente
      if (message.id !== undefined && this.pendingRequests.has(message.id)) {
        const handler = this.pendingRequests.get(message.id)!;
        clearTimeout(handler.timer);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          handler.reject(
            new Error(message.error.message || 'Erro JSON-RPC Moonraker')
          );
        } else {
          handler.resolve(message.result);
        }
        return;
      }

      // Notificações de telemetria do Klipper
      if (
        message.method === 'notify_status_update' &&
        Array.isArray(message.params)
      ) {
        const statusPayload = message.params[0];
        if (statusPayload) {
          this.processKlipperStatusUpdate(statusPayload);
        }
      }
    } catch {
      // Mensagens malformadas ignoradas em segurança
    }
  }

  processKlipperStatusUpdate(klipperStatus: MoonrakerKlipperStatus): void {
    const next: Partial<PrinterDriverStatus> = {};

    // Mapeamento explícito de estados do Klipper para EstadoLogico
    if (
      klipperStatus.webhooks?.state === 'shutdown' ||
      klipperStatus.webhooks?.state === 'error'
    ) {
      next.estadoLogico = 'error';
    } else if (klipperStatus.print_stats?.state) {
      const state = klipperStatus.print_stats.state.toLowerCase();
      switch (state) {
        case 'printing':
          next.estadoLogico = 'printing';
          break;
        case 'paused':
          next.estadoLogico = 'paused';
          break;
        case 'complete':
          next.estadoLogico = 'completed';
          break;
        case 'cancelled':
        case 'canceled':
          next.estadoLogico = 'idle';
          break;
        case 'standby':
        default:
          next.estadoLogico = 'idle';
          break;
      }
    }

    if (klipperStatus.print_stats?.filename !== undefined) {
      next.filename = klipperStatus.print_stats.filename;
    }

    if (klipperStatus.display_status?.progress !== undefined) {
      next.progress = Math.min(
        100,
        Math.max(0, Math.round(klipperStatus.display_status.progress * 100))
      );
    }

    if (klipperStatus.display_status?.current_layer !== undefined) {
      next.currentLayer = klipperStatus.display_status.current_layer;
    }

    if (klipperStatus.display_status?.total_layers !== undefined) {
      next.totalLayer = klipperStatus.display_status.total_layers;
    }

    if (klipperStatus.extruder?.temperature !== undefined) {
      next.tempNozzle =
        Math.round(klipperStatus.extruder.temperature * 10) / 10;
    }
    if (klipperStatus.extruder?.target !== undefined) {
      next.targetNozzle = Math.round(klipperStatus.extruder.target);
    }

    if (klipperStatus.heater_bed?.temperature !== undefined) {
      next.tempBed = Math.round(klipperStatus.heater_bed.temperature * 10) / 10;
    }
    if (klipperStatus.heater_bed?.target !== undefined) {
      next.targetBed = Math.round(klipperStatus.heater_bed.target);
    }

    if (klipperStatus.fan?.speed !== undefined) {
      next.fanSpeed = Math.round(klipperStatus.fan.speed * 100);
    }
    if (klipperStatus['fan_generic aux_fan']?.speed !== undefined) {
      next.fanAux = Math.round(
        klipperStatus['fan_generic aux_fan'].speed * 100
      );
    }
    if (klipperStatus['fan_generic case_fan']?.speed !== undefined) {
      next.fanBox = Math.round(
        klipperStatus['fan_generic case_fan'].speed * 100
      );
    }

    const lightPin =
      klipperStatus['output_pin caselight']?.value ??
      klipperStatus.output_pin?.value;
    const ledCase = klipperStatus['led case']?.color_data?.[0];
    if (ledCase && Array.isArray(ledCase)) {
      // White (4º elemento) ou R/G/B > 0
      const w = ledCase[3] ?? 0;
      const rgb = (ledCase[0] ?? 0) + (ledCase[1] ?? 0) + (ledCase[2] ?? 0);
      next.lightOn = w > 0 || rgb > 0;
    } else if (lightPin !== undefined) {
      next.lightOn = lightPin > 0;
    }

    if (klipperStatus.gcode_move?.homing_origin?.[2] !== undefined) {
      next.zOffset = klipperStatus.gcode_move.homing_origin[2];
    }

    const pos =
      klipperStatus.gcode_move?.gcode_position ??
      klipperStatus.toolhead?.position;
    if (pos && Array.isArray(pos) && pos.length >= 3) {
      next.position = [
        Math.round(pos[0] * 100) / 100,
        Math.round(pos[1] * 100) / 100,
        Math.round(pos[2] * 100) / 100,
      ];
    }

    this.updateStatus(next);
  }

  private updateStatus(patch: Partial<PrinterDriverStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) {
      try {
        listener(this.getStatus());
      } catch {}
    }
  }

  private cleanupSocket(): void {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(new Error('Ligação terminada'));
      this.pendingRequests.delete(id);
    }
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempt++;
    // Recuo progressivo: 1s, 2s, 5s, 10s máx
    const delay = Math.min(
      1000 * Math.pow(1.8, this.reconnectAttempt - 1),
      10000
    );
    this.reconnectTimeout = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect().catch(() => {});
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}
