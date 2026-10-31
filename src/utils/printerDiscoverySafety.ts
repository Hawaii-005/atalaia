import type { Printer } from '../types';
import type { DiscoveredPrinter } from './PrinterDiscovery';

export const getDiscoveryAddress = (
  advertised: unknown,
  sender: unknown
): string | null => {
  if (typeof advertised !== 'string' || advertised !== sender) return null;
  if (!/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(advertised)) {
    return null;
  }
  const [a, b, c, d] = advertised.split('.').map(Number);
  if ([a, b, c, d].some(part => part > 255)) return null;
  const local =
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254);
  return local ? advertised : null;
};

export const requestPrinterRecovery = async (
  printer: Pick<Printer, 'printerName' | 'mainboardId' | 'ipAddress' | 'kind'>,
  discovered: DiscoveredPrinter[],
  confirm: (candidate: DiscoveredPrinter) => Promise<boolean>
): Promise<DiscoveredPrinter | null> => {
  const candidate = discovered.find(
    item =>
      item.ip !== printer.ipAddress &&
      item.kind === (printer.kind ?? 'fdm') &&
      (printer.mainboardId
        ? item.mainboardId === printer.mainboardId
        : item.name.trim().toLowerCase() ===
          printer.printerName.trim().toLowerCase())
  );
  // SDCP identities are unauthenticated, even when the hardware ID matches.
  if (!candidate || !(await confirm(candidate))) return null;
  return candidate;
};
