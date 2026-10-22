import { Printer } from '../types';

/** Endereço a usar agora: o alternativo (Tailscale) quando está a ser usado. */
export const enderecoDe = (printer: Pick<Printer, 'ipAddress' | 'activeIp'> | undefined): string =>
  printer?.activeIp ?? printer?.ipAddress ?? '';

/** Um IP de Tailscale (100.64.0.0/10) não é local: a rede é outra. */
export const eTailscale = (ip: string): boolean => {
  const partes = ip.split('.').map(Number);
  if (partes.length !== 4 || partes.some(n => Number.isNaN(n))) return false;
  return partes[0] === 100 && partes[1] >= 64 && partes[1] <= 127;
};
