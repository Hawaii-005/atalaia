jest.mock('expo-network', () => ({
  getIpAddressAsync: jest.fn().mockResolvedValue('192.168.1.10'),
}));
jest.mock('react-native-udp', () => ({
  createSocket: jest.fn(),
}));

import { detectarTipoFirmware } from '../src/utils/PrinterDiscovery';

describe('Deteção e Descoberta de Firmware', () => {
  const originalFetch = global.fetch;
  const originalWebSocket = global.WebSocket;

  afterEach(() => {
    global.fetch = originalFetch;
    (global as any).WebSocket = originalWebSocket;
  });

  it('deteta Moonraker quando HTTP responde /server/info com sucesso', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          server_version: 'v0.8.0',
          klippy_state: 'ready',
        },
      }),
    });

    const res = await detectarTipoFirmware('192.168.1.150');
    expect(res).not.toBeNull();
    expect(res?.flavor).toBe('moonraker');
    expect(res?.printer?.kind).toBe('fdm');
    expect(res?.printer?.name).toContain('COSMOS');
  });

  it('deteta SDCP quando porta 3030 responde com atributos da Elegoo', async () => {
    // Falha HTTP 7125
    (global as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error('Connection refused'));

    // Mock WebSocket para porta 3030
    class MockDiscoveryWebSocket {
      url: string;
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          if (url.includes(':3030')) {
            this.onopen?.();
            this.onmessage?.({
              data: JSON.stringify({
                Attributes: {
                  Name: 'Centauri Original',
                  MachineName: 'Centauri Carbon',
                  FirmwareVersion: '1.2.3',
                  MainboardID: 'MB-1234',
                },
              }),
            });
          } else {
            this.onerror?.();
          }
        }, 10);
      }

      send() {}
      close() {}
    }

    (global as any).WebSocket = MockDiscoveryWebSocket;

    const res = await detectarTipoFirmware('192.168.1.160');
    expect(res).not.toBeNull();
    expect(res?.flavor).toBe('sdcp');
    expect(res?.printer?.name).toBe('Centauri Original');
    expect(res?.printer?.firmware).toBe('1.2.3');
  });

  it('retorna null se a impressora estiver desligada em ambas as portas', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('Timeout'));

    class MockOfflineWebSocket {
      onerror: (() => void) | null = null;
      constructor() {
        setTimeout(() => this.onerror?.(), 5);
      }
      send() {}
      close() {}
    }
    (global as any).WebSocket = MockOfflineWebSocket;

    const res = await detectarTipoFirmware('192.168.1.99');
    expect(res).toBeNull();
  });
});
