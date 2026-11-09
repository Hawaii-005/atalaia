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

  it('estabelece ligação WebSocket e envia printer.objects.subscribe', async () => {
    const driver = new MoonrakerDriver({
      id: 'cosmos-1',
      name: 'Centauri Cosmos',
      ipAddress: '192.168.1.150',
    });

    await driver.connect();

    expect(MockWebSocket.instances.length).toBe(1);
    const mockWs = MockWebSocket.instances[0];
    expect(mockWs.url).toBe('ws://192.168.1.150/websocket');

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

  describe('Fase 4 - Escrita e Operações (Comandos de Impressão e Ficheiros)', () => {
    it('despacha comando de iniciar impressão (Cmd 128) via printer.print.start', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      const sendPromise = driver.sendCommand({
        Id: 'test-start',
        Data: {
          Cmd: 128,
          Data: { Filename: 'teste_peça.gcode' },
        },
      });

      // Aguarda tick do envio
      await new Promise(r => setTimeout(r, 10));
      const rpcMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'printer.print.start');

      expect(rpcMsg).toBeDefined();
      expect(rpcMsg.params).toEqual({ filename: 'teste_peça.gcode' });

      // Simula resposta RPC
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: rpcMsg.id,
        result: 'ok',
      });

      const res = await sendPromise;
      expect(res.Data.Ack).toBe(0);
      expect(res.Data.Cmd).toBe(128);
      await driver.disconnect();
    });

    it('aplica mapeamento AFC SET_MAP quando slot_map é fornecido no Cmd 128', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      const sendPromise = driver.sendCommand({
        Id: 'test-start-afc',
        Data: {
          Cmd: 128,
          Data: {
            Filename: 'teste_multicolor.gcode',
            slot_map: [
              { t: 0, tray_id: 1 },
              { t: 1, tray_id: 0 },
            ],
          },
        },
      });

      await new Promise(r => setTimeout(r, 10));

      // Deve ter despachado gcode script SET_MAP
      const gcodeMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'printer.gcode.script');

      expect(gcodeMsg).toBeDefined();
      expect(gcodeMsg.params.script).toContain('SET_MAP LANE=CANVAS_2 MAP=T0');
      expect(gcodeMsg.params.script).toContain('SET_MAP LANE=CANVAS_1 MAP=T1');

      // Responde ao gcode script
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: gcodeMsg.id,
        result: 'ok',
      });

      await new Promise(r => setTimeout(r, 10));

      const printMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'printer.print.start');

      expect(printMsg).toBeDefined();
      expect(printMsg.params.filename).toBe('teste_multicolor.gcode');

      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: printMsg.id,
        result: 'ok',
      });

      const res = await sendPromise;
      expect(res.Data.Ack).toBe(0);
      await driver.disconnect();
    });

    it('despacha comandos de pausa (129), cancelamento (130) e retoma (131)', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      // Cmd 129: Pausar
      const pausePromise = driver.sendCommand({
        Id: 'test-pause',
        Data: { Cmd: 129, Data: {} },
      });
      await new Promise(r => setTimeout(r, 10));
      const pauseMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'printer.print.pause');
      expect(pauseMsg).toBeDefined();
      mockWs.triggerMessage({ jsonrpc: '2.0', id: pauseMsg.id, result: 'ok' });
      await pausePromise;

      // Cmd 130: Cancelar
      const cancelPromise = driver.sendCommand({
        Id: 'test-cancel',
        Data: { Cmd: 130, Data: {} },
      });
      await new Promise(r => setTimeout(r, 10));
      const cancelMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'printer.print.cancel');
      expect(cancelMsg).toBeDefined();
      mockWs.triggerMessage({ jsonrpc: '2.0', id: cancelMsg.id, result: 'ok' });
      await cancelPromise;

      // Cmd 131: Retomar
      const resumePromise = driver.sendCommand({
        Id: 'test-resume',
        Data: { Cmd: 131, Data: {} },
      });
      await new Promise(r => setTimeout(r, 10));
      const resumeMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'printer.print.resume');
      expect(resumeMsg).toBeDefined();
      mockWs.triggerMessage({ jsonrpc: '2.0', id: resumeMsg.id, result: 'ok' });
      await resumePromise;

      await driver.disconnect();
    });

    it('despacha listagem (Cmd 258) e eliminação de ficheiros (Cmd 259)', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      // Cmd 258: Listar ficheiros
      const listPromise = driver.sendCommand({
        Id: 'test-list',
        Data: { Cmd: 258, Data: {} },
      });
      await new Promise(r => setTimeout(r, 10));
      const listMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'server.files.get_directory' ||
            m.method === 'server.files.list'
        );
      expect(listMsg).toBeDefined();
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: listMsg.id,
        result: {
          files: [
            { filename: 'caixa.gcode', size: 10240, modified: 1700000000 },
            { filename: 'suporte.gcode', size: 20480, modified: 1700000500 },
          ],
        },
      });
      const listRes = await listPromise;
      expect(listRes.Data.Ack).toBe(0);
      expect((listRes.Data.Data as any).FileList).toHaveLength(2);
      expect((listRes.Data.Data as any).FileList[0].name).toBe('caixa.gcode');

      // Cmd 259: Eliminar ficheiro
      const delPromise = driver.sendCommand({
        Id: 'test-del',
        Data: {
          Cmd: 259,
          Data: { FileList: ['caixa.gcode'] },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const delMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'server.files.delete_file');
      expect(delMsg).toBeDefined();
      expect(delMsg.params).toEqual({ path: 'gcodes/caixa.gcode' });
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: delMsg.id,
        result: 'caixa.gcode',
      });
      const delRes = await delPromise;
      expect(delRes.Data.Ack).toBe(0);

      await driver.disconnect();
    });

    it('despacha comandos de movimento jog (Cmd 401) e home (Cmd 402)', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      // Cmd 401: Jog X +10
      const jogPromise = driver.sendCommand({
        Id: 'test-jog',
        Data: {
          Cmd: 401,
          Data: { Axis: 'X', Step: 10 },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const jogMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'printer.gcode.script' &&
            m.params?.script?.includes('G1 X10')
        );
      expect(jogMsg).toBeDefined();
      expect(jogMsg.params.script).toBe('G91\nG1 X10 F3000\nG90');
      mockWs.triggerMessage({ jsonrpc: '2.0', id: jogMsg.id, result: 'ok' });
      await jogPromise;

      // Cmd 402: Home Z
      const homeZPromise = driver.sendCommand({
        Id: 'test-home-z',
        Data: {
          Cmd: 402,
          Data: { Axis: 'Z' },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const homeZMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'printer.gcode.script' && m.params?.script === 'G28 Z'
        );
      expect(homeZMsg).toBeDefined();
      mockWs.triggerMessage({ jsonrpc: '2.0', id: homeZMsg.id, result: 'ok' });
      await homeZPromise;

      // Cmd 402: Home XYZ
      const homeAllPromise = driver.sendCommand({
        Id: 'test-home-all',
        Data: {
          Cmd: 402,
          Data: { Axis: 'XYZ' },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const homeAllMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m => m.method === 'printer.gcode.script' && m.params?.script === 'G28'
        );
      expect(homeAllMsg).toBeDefined();
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: homeAllMsg.id,
        result: 'ok',
      });
      await homeAllPromise;

      await driver.disconnect();
    });

    it('despacha comandos de luz, velocidade, ventoinha e temperaturas (Cmd 403)', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      // Luz ON
      const lightPromise = driver.sendCommand({
        Id: 'test-light',
        Data: {
          Cmd: 403,
          Data: { LightStatus: { SecondLight: 1 } },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const lightMsg = mockWs.sentMessages
        .map(s => JSON.parse(s))
        .find(
          m =>
            m.method === 'printer.gcode.script' &&
            m.params?.script?.includes('SET_LED LED="case" WHITE=1.0')
        );
      expect(lightMsg).toBeDefined();
      mockWs.triggerMessage({ jsonrpc: '2.0', id: lightMsg.id, result: 'ok' });
      await lightPromise;

      // Velocidade 120%
      const speedPromise = driver.sendCommand({
        Id: 'test-speed',
        Data: {
          Cmd: 403,
          Data: { PrintSpeedPct: 120 },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const speedMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'printer.gcode.script' &&
            m.params?.script?.includes('M220 S120')
        );
      expect(speedMsg).toBeDefined();
      mockWs.triggerMessage({ jsonrpc: '2.0', id: speedMsg.id, result: 'ok' });
      await speedPromise;

      // Ventoinha e Temperaturas em lote
      const fanTempPromise = driver.sendCommand({
        Id: 'test-fan-temp',
        Data: {
          Cmd: 403,
          Data: {
            TargetFanSpeed: { ModelFan: 100 },
            TempTargetNozzle: 215,
            TempTargetHotbed: 60,
          },
        },
      });
      await new Promise(r => setTimeout(r, 10));
      const fanTempMsg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'printer.gcode.script' &&
            m.params?.script?.includes('M106 S255') &&
            m.params?.script?.includes('M104 S215') &&
            m.params?.script?.includes('M140 S60')
        );
      expect(fanTempMsg).toBeDefined();
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: fanTempMsg.id,
        result: 'ok',
      });
      await fanTempPromise;

      await driver.disconnect();
    });

    it('processa telemetria estendida: ventoinha, luz, z-offset e coordenadas', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();

      driver.processKlipperStatusUpdate({
        fan: { speed: 0.8 },
        'output_pin caselight': { value: 1.0 },
        gcode_move: {
          gcode_position: [120.5, 80.25, 15.0, 0],
          homing_origin: [0, 0, -0.05, 0],
          speed_factor: 1.0,
        },
      });

      const st = driver.getStatus();
      expect(st.fanSpeed).toBe(80);
      expect(st.lightOn).toBe(true);
      expect(st.zOffset).toBe(-0.05);
      expect(st.position).toEqual([120.5, 80.25, 15.0]);

      const appStatus = driver.getAppPrinterStatus();
      expect(appStatus.CurrentFanSpeed.ModelFan).toBe(80);
      expect(appStatus.LightStatus.SecondLight).toBe(1);
      expect(appStatus.ZOffset).toBe(-0.05);
      expect(appStatus.CurrenCoord).toBe('X:120.50 Y:80.25 Z:15.00');

      await driver.disconnect();
    });

    it('calcula camadas, tempo decorrido/total e miniatura a partir da telemetria e metadados', () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });

      // 1. Atualização com print_stats.info (padrão OrcaSlicer/Elegoo)
      driver.processKlipperStatusUpdate({
        print_stats: {
          state: 'printing',
          filename: 'teste.gcode',
          print_duration: 1800,
          total_duration: 1920,
          info: { current_layer: 40, total_layer: 200 },
        },
        display_status: { progress: 0.2 },
      });

      let st = driver.getAppPrinterStatus();
      expect(st.PrintInfo.CurrentLayer).toBe(40);
      expect(st.PrintInfo.TotalLayer).toBe(200);
      expect(st.PrintInfo.CurrentTicks).toBe(1800);
      // Sem estimated_time definido nos metadados, total é calculado com base no progresso (1800 / 0.2 = 9000)
      expect(st.PrintInfo.TotalTicks).toBe(9000);

      // 2. Fallback de interpolação da camada quando print_stats.info não tem current_layer
      driver.processKlipperStatusUpdate({
        print_stats: {
          state: 'printing',
          filename: 'teste.gcode',
          print_duration: 1800,
          info: { current_layer: null, total_layer: 100 },
        },
        display_status: { progress: 0.5 },
      });

      st = driver.getAppPrinterStatus();
      expect(st.PrintInfo.TotalLayer).toBe(100);
      // 50% de 100 camadas = camada 50
      expect(st.PrintInfo.CurrentLayer).toBe(50);
    });

    it('responde ao Cmd 260 (detalhes do ficheiro) mapeando metadados do Moonraker para o formato SDCP', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      expect(MockWebSocket.instances.length).toBe(1);
      const mockWs = MockWebSocket.instances[0];

      const promise260 = driver.sendCommand({
        Id: 'test-260',
        Data: {
          Cmd: 260,
          Data: { Url: '/local/peca_teste.gcode' },
        },
      });

      await new Promise(r => setTimeout(r, 10));

      // Deve ter chamado server.files.metadata para o ficheiro peca_teste.gcode
      const metaReq = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'server.files.metadata' &&
            m.params?.filename === 'peca_teste.gcode'
        );
      expect(metaReq).toBeDefined();

      // Devolve metadados típicos do Moonraker / OrcaSlicer
      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: metaReq.id,
        result: {
          filename: 'peca_teste.gcode',
          size: 1542000,
          modified: 1714000000,
          slicer: 'OrcaSlicer',
          layer_count: 150,
          estimated_time: 4200,
          filament_total: 35.8,
          filament_weight_total: 42.5,
          filament_colors: ['#E91E63', '#4CAF50'],
          filament_type: ['PLA', 'PETG'],
          filament_name: ['PLA Red', 'PETG Green'],
          thumbnails: [
            {
              relative_path: '.thumbs/peca_teste-300x300.png',
              width: 300,
              height: 300,
            },
          ],
        },
      });

      const res: any = await promise260;
      expect(res.Data.Cmd).toBe(260);
      expect(res.Data.Ack).toBe(0);
      expect(res.Data.Data.FileInfo).toBeDefined();
      expect(res.Data.Data.FileInfo.TotalLayer).toBe(150);
      expect(res.Data.Data.FileInfo.EstTime).toBe(4200);
      expect(res.Data.Data.FileInfo.EstWeight).toBe(42.5);
      expect(res.Data.Data.FileInfo.Thumbnail).toContain(
        '.thumbs/peca_teste-300x300.png'
      );
      expect(res.Data.Data.FileInfo.ColorMapping).toHaveLength(2);
      expect(res.Data.Data.FileInfo.ColorMapping[0]).toEqual({
        color: '#E91E63',
        tray_id: 0,
        filament_type: 'PLA',
        filament_name: 'PLA Red',
      });
      expect(res.Data.Data.FileInfo.ColorMapping[1]).toEqual({
        color: '#4CAF50',
        tray_id: 1,
        filament_type: 'PETG',
        filament_name: 'PETG Green',
      });

      await driver.disconnect();
    });

    it('responde ao Cmd 320 e Cmd 321 (histórico de impressão) consultando server.history do Moonraker', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      expect(MockWebSocket.instances.length).toBe(1);
      const mockWs = MockWebSocket.instances[0];

      // 1. Cmd 320: Lista de IDs
      const promise320 = driver.sendCommand({
        Id: 'test-320',
        Data: {
          Cmd: 320,
          Data: {},
        },
      });

      await new Promise(r => setTimeout(r, 10));

      const histReq = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(m => m.method === 'server.history.list');
      expect(histReq).toBeDefined();

      mockWs.triggerMessage({
        jsonrpc: '2.0',
        id: histReq.id,
        result: {
          jobs: [
            {
              job_id: 'job-001',
              filename: 'boneco.gcode',
              start_time: 1714000000,
              end_time: 1714003600,
              status: 'completed',
              print_duration: 3500,
              total_duration: 3600,
            },
            {
              job_id: 'job-002',
              filename: 'suporte.gcode',
              start_time: 1714004000,
              end_time: 1714005000,
              status: 'cancelled',
              print_duration: 800,
              total_duration: 1000,
            },
          ],
        },
      });

      const res320: any = await promise320;
      expect(res320.Data.Cmd).toBe(320);
      expect(res320.Data.Data.HistoryData).toEqual(['job-001', 'job-002']);

      // 2. Cmd 321: Detalhes dos jobs por ID
      const promise321 = driver.sendCommand({
        Id: 'test-321',
        Data: {
          Cmd: 321,
          Data: { Id: ['job-001', 'job-002'] },
        },
      });

      const res321: any = await promise321;
      expect(res321.Data.Cmd).toBe(321);
      expect(res321.Data.Data.HistoryDetailList.length).toBe(2);

      const job1 = res321.Data.Data.HistoryDetailList[0];
      expect(job1.TaskId).toBe('job-001');
      expect(job1.TaskName).toBe('boneco.gcode');
      expect(job1.TaskStatus).toBe(1); // 1 = concluída
      expect(job1.BeginTime).toBe(1714000000);
      expect(job1.EndTime).toBe(1714003600);

      const job2 = res321.Data.Data.HistoryDetailList[1];
      expect(job2.TaskId).toBe('job-002');
      expect(job2.TaskStatus).toBe(3); // 3 = parada/cancelada

      await driver.disconnect();
    });

    it('despacha SET_WEIGHT para o Canvas AFC via Cmd 403', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      const promise = driver.sendCommand({
        Id: 'test-weight',
        Data: {
          Cmd: 403,
          Data: {
            LaneWeight: { Lane: 2, Weight: 250 },
          },
        },
      });

      await new Promise(r => setTimeout(r, 10));
      const msg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'printer.gcode.script' &&
            m.params?.script?.includes('SET_WEIGHT')
        );
      expect(msg).toBeDefined();
      expect(msg.params.script).toBe('SET_WEIGHT LANE=CANVAS_2 WEIGHT=250');
      mockWs.triggerMessage({ jsonrpc: '2.0', id: msg.id, result: 'ok' });
      await promise;

      await driver.disconnect();
    });

    it('despacha script G-code ou Macro Klipper via Cmd 1025', async () => {
      const driver = new MoonrakerDriver({
        id: 'cosmos-1',
        name: 'Centauri Cosmos',
        ipAddress: '192.168.1.150',
      });
      await driver.connect();
      const mockWs = MockWebSocket.instances[0];

      const promise = driver.sendCommand({
        Id: 'test-gcode',
        Data: {
          Cmd: 1025,
          Data: { Script: 'BED_MESH_CALIBRATE' },
        },
      });

      await new Promise(r => setTimeout(r, 10));
      const msg = mockWs.sentMessages
        .map(m => JSON.parse(m))
        .find(
          m =>
            m.method === 'printer.gcode.script' &&
            m.params?.script === 'BED_MESH_CALIBRATE'
        );
      expect(msg).toBeDefined();
      expect(msg.params.script).toBe('BED_MESH_CALIBRATE');
      mockWs.triggerMessage({ jsonrpc: '2.0', id: msg.id, result: 'ok' });
      await promise;

      await driver.disconnect();
    });
  });
});
