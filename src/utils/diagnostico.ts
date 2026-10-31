import { Printer } from '../types';
import appJson from '../../app.json';

export function mascararIp(ip?: string): string {
  if (!ip) return '***';
  const partes = ip.split('.');
  if (partes.length === 4) {
    return `${partes[0]}.${partes[1]}.***.***`;
  }
  return ip.substring(0, Math.min(4, ip.length)) + '***';
}

export function gerarRelatorioDiagnostico(
  printers: Printer[],
  errosRecentes: { timestamp: string; message: string }[] = [],
  platformaOS: string = 'android'
): string {
  const relatorio = {
    app: {
      nome: appJson.expo.name,
      versao: appJson.expo.version,
      build: appJson.expo.android?.versionCode ?? 0,
      plataforma: platformaOS,
      geradoEm: new Date().toISOString(),
    },
    impressoras: printers.map(p => ({
      nome: p.printerName,
      tipo: p.kind ?? 'fdm',
      ipMascarado: mascararIp(p.ipAddress),
      ipAlternativoMascarado: mascararIp(p.alternateIp),
      estadoConexao: p.connectionStatus,
      rawStatus: p.status?.PrintInfo?.Status,
      errorNumber: p.status?.PrintInfo?.ErrorNumber,
    })),
    errosRecentes,
  };

  return JSON.stringify(relatorio, null, 2);
}
