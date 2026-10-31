import {
  mascararIp,
  gerarRelatorioDiagnostico,
} from '../src/utils/diagnostico';

describe('Diagnóstico e Mascaramento de IPs', () => {
  it('mascara corretamente endereços IPv4', () => {
    expect(mascararIp('192.168.1.50')).toBe('192.168.***.***');
    expect(mascararIp('10.0.0.12')).toBe('10.0.***.***');
  });

  it('gera relatório de diagnóstico em formato JSON válido', () => {
    const relatorio = gerarRelatorioDiagnostico([
      {
        id: 'p1',
        printerName: 'Centauri 1',
        ipAddress: '192.168.1.100',
        connectionStatus: 'connected',
      } as any,
    ]);

    const parsed = JSON.parse(relatorio);
    expect(parsed.app).toBeDefined();
    expect(parsed.impressoras.length).toBe(1);
    expect(parsed.impressoras[0].ipMascarado).toBe('192.168.***.***');
  });
});
