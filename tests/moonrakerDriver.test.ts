import { MoonrakerDriver } from '../src/protocol/drivers/MoonrakerDriver';

// Simulação de WebSocket para testes isolados sem dependência de rede
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 5);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  triggerMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  triggerRawMessage(data: string) {
    this.onmessage?.({ data });
  }
}

describe('MoonrakerDriver (Fase 2 - Leitura e Telemetria)', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    (global as any).WebSocket = originalWebSocket;
  });

  it('inicia com capacidades COSMOS corretas e estado desligado', () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    expect(driver.firmware).toBe('moonraker');
    expect(driver.kind).toBe('fdm');
    expect(driver.capabilities.consolaGcode).toBe(true);
    expect(driver.capabilities.babyStepping).toBe(true);
    expect(driver.capabilities.timelapseSdcp).toBe(false);

    const status = driver.getStatus();
    expect(status.connected).toBe(false);
    expect(status.estadoLogico).toBe('idle');
  });

  it('estabelece ligação WebSocket na porta 7125 e envia printer.objects.subscribe', async () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    await driver.connect();

    expect(MockWebSocket.instances.length).toBe(1);
    const mockWs = MockWebSocket.instances[0];
    expect(mockWs.url).toBe('ws://192.168.1.150:7125/websocket');

    // Aguarda microtask para envio do subscribe
    await new Promise(r => setTimeout(r, 10));

    // Responde ao pedido de subscrição (ID gerado pelo driver)
    const lastSent = JSON.parse(mockWs.sentMessages[0]);
    expect(lastSent.method).toBe('printer.objects.subscribe');

    mockWs.triggerMessage({
      jsonrpc: '2.0',
      id: lastSent.id,
      result: {
        status: {
          print_stats: { state: 'standby' },
          extruder: { temperature: 24.5, target: 0 },
          heater_bed: { temperature: 22.0, target: 0 },
        },
      },
    });

    await new Promise(r => setTimeout(r, 10));

    const status = driver.getStatus();
    expect(status.connected).toBe(true);
    expect(status.estadoLogico).toBe('idle');
    expect(status.tempNozzle).toBe(24.5);
    expect(status.tempBed).toBe(22);
  });

  it('mapeia estados do Klipper para EstadoLogico corretamente', () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    // 1. Printing
    driver.processKlipperStatusUpdate({
      print_stats: { state: 'printing', filename: 'peça.gcode' },
      display_status: { progress: 0.45, current_layer: 45, total_layers: 100 },
      extruder: { temperature: 210.2, target: 210 },
      heater_bed: { temperature: 60.1, target: 60 },
    });

    let status = driver.getStatus();
    expect(status.estadoLogico).toBe('printing');
    expect(status.filename).toBe('peça.gcode');
    expect(status.progress).toBe(45);
    expect(status.currentLayer).toBe(45);
    expect(status.totalLayer).toBe(100);
    expect(status.tempNozzle).toBe(210.2);
    expect(status.tempBed).toBe(60.1);

    // 2. Paused
    driver.processKlipperStatusUpdate({
      print_stats: { state: 'paused' },
    });
    expect(driver.getStatus().estadoLogico).toBe('paused');

    // 3. Complete
    driver.processKlipperStatusUpdate({
      print_stats: { state: 'complete' },
    });
    expect(driver.getStatus().estadoLogico).toBe('completed');

    // 4. Cancelled -> idle
    driver.processKlipperStatusUpdate({
      print_stats: { state: 'cancelled' },
    });
    expect(driver.getStatus().estadoLogico).toBe('idle');

    // 5. Klipper Shutdown / Error
    driver.processKlipperStatusUpdate({
      webhooks: {
        state: 'shutdown',
        state_message: 'Klipper shutdown: MCU disconnected',
      },
    });
    expect(driver.getStatus().estadoLogico).toBe('error');
  });

  it('trata notificações notify_status_update recebidas por WebSocket', async () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    await driver.connect();
    const mockWs = MockWebSocket.instances[0];

    // Aguarda envio do subscribe inicial
    await new Promise(r => setTimeout(r, 10));
    const lastSent = JSON.parse(mockWs.sentMessages[0]);
    mockWs.triggerMessage({
      jsonrpc: '2.0',
      id: lastSent.id,
      result: { status: {} },
    });

    // Recebe notificação push de telemetria
    mockWs.triggerMessage({
      jsonrpc: '2.0',
      method: 'notify_status_update',
      params: [
        {
          extruder: { temperature: 215.0, target: 215 },
          display_status: { progress: 0.88 },
        },
        1700000000,
      ],
    });

    const status = driver.getStatus();
    expect(status.tempNozzle).toBe(215);
    expect(status.progress).toBe(88);
  });

  it('não crasha com mensagens malformadas ou JSON inválido', async () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    await driver.connect();
    const mockWs = MockWebSocket.instances[0];
    await new Promise(r => setTimeout(r, 10));
    const lastSent = JSON.parse(mockWs.sentMessages[0]);
    mockWs.triggerMessage({
      jsonrpc: '2.0',
      id: lastSent.id,
      result: { status: {} },
    });

    // Dispara strings quebradas
    expect(() => {
      mockWs.triggerRawMessage('{ broken json ...');
      mockWs.triggerRawMessage('null');
      mockWs.triggerRawMessage('12345');
    }).not.toThrow();
  });

  it('agenda reconexão com recuo progressivo em caso de fecho inesperado', async () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    await driver.connect();
    expect(MockWebSocket.instances.length).toBe(1);
    const mockWs = MockWebSocket.instances[0];

    // Simula fecho abrupto do socket sem ser chamado disconnect()
    mockWs.close();
    expect(driver.getStatus().connected).toBe(false);

    // Aguarda o primeiro intervalo de recuo (~1000ms)
    await new Promise(r => setTimeout(r, 1100));

    // A reconexão automática deve ter instanciado um novo socket
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);

    await driver.disconnect();
  });
});
