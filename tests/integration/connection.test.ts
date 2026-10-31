import { FakeSdcpServer } from '../mocks/fakeSdcpServer';
import { CentauriDriver } from '../../src/protocol/drivers/CentauriDriver';

describe('Testes de Integração com Servidor SDCP Falso', () => {
  let server: FakeSdcpServer;
  const PORT = 3039;

  beforeAll(async () => {
    server = new FakeSdcpServer({
      wsPort: PORT,
      tcpPort: 3009,
      ackMode: 'ok',
      statusCode: 0,
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('liga ao servidor e recebe atualizações de estado', async () => {
    const driver = new CentauriDriver({
      id: 'f1',
      name: 'Centauri Teste',
      ipAddress: `127.0.0.1:${PORT}/websocket`,
    });

    await driver.connect();
    expect(driver.getStatus().connected).toBe(true);

    await driver.disconnect();
    expect(driver.getStatus().connected).toBe(false);
  });

  it('suporta recusa de Ack pelo servidor', async () => {
    server.setAckMode('refuse');
    const driver = new CentauriDriver({
      id: 'f1',
      name: 'Centauri Teste',
      ipAddress: `127.0.0.1:${PORT}/websocket`,
    });

    await driver.connect();
    const res = await driver.sendCommand({
      Id: 'cmd-1',
      Data: { Cmd: 128, Data: { filename: 'teste.gcode' } },
    });
    expect(res.Id).toBe('cmd-1');

    await driver.disconnect();
  });

  it('tolera mensagens malformadas do servidor sem crashar', async () => {
    server.setAckMode('malformed');
    const driver = new CentauriDriver({
      id: 'f1',
      name: 'Centauri Teste',
      ipAddress: `127.0.0.1:${PORT}/websocket`,
    });

    await driver.connect();
    expect(driver.getStatus().connected).toBe(true);

    await driver.disconnect();
  });
});
