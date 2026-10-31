import {
  getDiscoveryAddress,
  requestPrinterRecovery,
} from '../src/utils/printerDiscoverySafety';
import type { DiscoveredPrinter } from '../src/utils/PrinterDiscovery';

const printer = {
  printerName: 'Centauri',
  mainboardId: 'saved-board',
  ipAddress: '192.168.68.10',
  kind: 'fdm' as const,
};
const candidate: DiscoveredPrinter = {
  name: 'Centauri',
  mainboardId: 'saved-board',
  ip: '192.168.69.20',
  kind: 'fdm',
};

describe('discovery destination validation', () => {
  it('accepts a LAN sender across /24 boundaries', () => {
    expect(getDiscoveryAddress(candidate.ip, candidate.ip)).toBe(candidate.ip);
  });

  it.each([
    ['203.0.113.1', '192.168.68.20'],
    ['192.168.68.30', '192.168.68.20'],
    ['8.8.8.8', '8.8.8.8'],
    ['127.0.0.1', '127.0.0.1'],
    ['192.168.999.1', '192.168.999.1'],
    ['192.168.068.1', '192.168.068.1'],
    ['192.168.68.1/path', '192.168.68.1/path'],
    [undefined, '192.168.68.20'],
    [123, 123],
  ])('rejects advertised %s from %s', (advertised, sender) => {
    expect(getDiscoveryAddress(advertised, sender)).toBeNull();
  });
});

describe('saved printer recovery', () => {
  it('does not trust a matching name with a different or missing board ID', async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    for (const mainboardId of ['attacker-board', undefined]) {
      expect(
        await requestPrinterRecovery(
          printer,
          [{ ...candidate, mainboardId }],
          confirm
        )
      ).toBeNull();
    }
    expect(confirm).not.toHaveBeenCalled();
  });

  it('requires explicit approval even when the board ID matches', async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    expect(
      await requestPrinterRecovery(printer, [candidate], confirm)
    ).toBeNull();
    expect(confirm).toHaveBeenCalledWith(candidate);
    confirm.mockResolvedValue(true);
    expect(await requestPrinterRecovery(printer, [candidate], confirm)).toBe(
      candidate
    );
  });

  it('waits for the user rather than returning an unapproved destination', async () => {
    let approve!: (value: boolean) => void;
    let finished = false;
    const result = requestPrinterRecovery(
      printer,
      [candidate],
      () => new Promise<boolean>(resolve => (approve = resolve))
    ).then(value => {
      finished = true;
      return value;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    approve(false);
    expect(await result).toBeNull();
  });

  it('allows legacy name-only printers only with approval', async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    expect(
      await requestPrinterRecovery(
        { ...printer, mainboardId: undefined },
        [{ ...candidate, name: ' centauri ' }],
        confirm
      )
    ).toMatchObject({ ip: candidate.ip });
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('does not propose the current address or another printer family', async () => {
    const confirm = jest.fn().mockResolvedValue(true);
    expect(
      await requestPrinterRecovery(
        printer,
        [
          { ...candidate, ip: printer.ipAddress },
          { ...candidate, kind: 'resin' },
        ],
        confirm
      )
    ).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });
});
