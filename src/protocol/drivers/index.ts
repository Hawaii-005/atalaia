import { Printer } from '../../types';
import { PrinterDriver } from './PrinterDriver';
import { CentauriDriver } from './CentauriDriver';
import { SaturnDriver } from './SaturnDriver';
import { MoonrakerDriver } from './MoonrakerDriver';

export * from './PrinterDriver';
export * from './CentauriDriver';
export * from './SaturnDriver';
export * from './MoonrakerDriver';

export function criarDriver(printer: Printer): PrinterDriver {
  const options = {
    id: printer.id,
    name: printer.printerName,
    ipAddress: printer.ipAddress,
    mainboardId: printer.mainboardId,
    alternateIp: printer.alternateIp,
  };

  if (printer.kind === 'resin') {
    return new SaturnDriver(options);
  }

  if (printer.firmware === 'moonraker') {
    return new MoonrakerDriver(options);
  }

  return new CentauriDriver(options);
}
