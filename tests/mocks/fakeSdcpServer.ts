import { WebSocketServer, WebSocket } from 'ws';
import * as net from 'net';

export interface FakeSdcpServerConfig {
  wsPort?: number;
  tcpPort?: number;
  ackMode?: 'ok' | 'refuse' | 'timeout' | 'malformed';
  statusCode?: number;
}

export class FakeSdcpServer {
  private wss: WebSocketServer | null = null;
  private tcpServer: net.Server | null = null;
  private config: FakeSdcpServerConfig;
  private activeWs: WebSocket | null = null;

  constructor(config: FakeSdcpServerConfig = {}) {
    this.config = {
      wsPort: config.wsPort ?? 3030,
      tcpPort: config.tcpPort ?? 3000,
      ackMode: config.ackMode ?? 'ok',
      statusCode: config.statusCode ?? 0,
    };
  }

  setAckMode(mode: 'ok' | 'refuse' | 'timeout' | 'malformed') {
    this.config.ackMode = mode;
  }

  setStatusCode(code: number) {
    this.config.statusCode = code;
  }

  async start(): Promise<void> {
    // Servidor WebSocket (Centauri FDM)
    await new Promise<void>(resolve => {
      this.wss = new WebSocketServer({ port: this.config.wsPort }, () => {
        resolve();
      });
    });

    this.wss?.on('connection', ws => {
      this.activeWs = ws;
      ws.on('message', data => {
        if (this.config.ackMode === 'timeout') return;

        if (this.config.ackMode === 'malformed') {
          ws.send('MENSAGEM_INVALIDA_JSON{');
          return;
        }

        try {
          const parsed = JSON.parse(data.toString());
          const reqId = parsed?.Data?.RequestID ?? 'req-1';
          const cmd = parsed?.Data?.Cmd ?? 0;

          if (cmd === 0) {
            // Pedido de estado
            ws.send(
              JSON.stringify({
                Id: parsed.Id,
                Data: {
                  Cmd: 0,
                  Data: {
                    PrintInfo: {
                      Status: this.config.statusCode,
                      Progress: 50,
                      Filename: 'teste.gcode',
                    },
                  },
                  Ack: 0,
                  RequestID: reqId,
                },
              })
            );
          } else {
            // Comando de controlo (imprimir, pausar, parar)
            const ack = this.config.ackMode === 'refuse' ? 1 : 0;
            ws.send(
              JSON.stringify({
                Id: parsed.Id,
                Data: {
                  Cmd: cmd,
                  Data: {},
                  Ack: ack,
                  RequestID: reqId,
                },
              })
            );
          }
        } catch {
          ws.send('MENSAGEM_INVALIDA_JSON');
        }
      });
    });

    // Servidor TCP (Saturn Resina)
    await new Promise<void>(resolve => {
      this.tcpServer = net.createServer(socket => {
        socket.on('data', data => {
          if (this.config.ackMode === 'timeout') return;
          if (this.config.ackMode === 'malformed') {
            socket.write('INVALID_TCP_FRAME\n');
            return;
          }
          const resp = JSON.stringify({
            Cmd: 0,
            Data: { Status: this.config.statusCode },
            Ack: this.config.ackMode === 'refuse' ? 1 : 0,
          });
          socket.write(resp + '\n');
        });
      });
      this.tcpServer.listen(this.config.tcpPort, () => resolve());
    });
  }

  fecharSocketRepentimente() {
    if (this.activeWs) {
      this.activeWs.close();
      this.activeWs = null;
    }
  }

  async stop(): Promise<void> {
    if (this.activeWs) {
      this.activeWs.close();
    }
    await new Promise<void>(resolve => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
    await new Promise<void>(resolve => {
      if (this.tcpServer) {
        this.tcpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
