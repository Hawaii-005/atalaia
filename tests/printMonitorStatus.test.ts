import { Printer, PrintInfo, PrinterStatus } from '../src/types';
import en from '../src/i18n/en';
import {
  buildPrintMonitorStatus,
  printMonitorArguments,
} from '../src/utils/printMonitorStatus';
import { createPrintMonitorService } from '../src/utils/printMonitorService';

const now = 1000000;
const translate = (key: string, params?: Record<string, string | number>) => {
  const value = (en as Record<string, string>)[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params?.[name]));
};
const printer = (
  info: Partial<PrintInfo> = {},
  fields: Partial<Printer> = {}
): Printer => ({
  id: 'one',
  printerName: 'Centauri',
  ipAddress: '192.168.1.10',
  connectionStatus: 'connected',
  lastUpdate: now - 1000,
  status: {
    PrintInfo: {
      Filename: 'sample.gcode',
      Status: 6,
      Progress: 42,
      CurrentTicks: 600,
      TotalTicks: 4200,
      ...info,
    },
  } as PrinterStatus,
  ...fields,
});
const model = (
  printers: Printer[] = [printer()],
  interval = 31000,
  time = now
) => buildPrintMonitorStatus(printers, interval, time, translate);

describe('ongoing print notification status', () => {
  it('shows the printer, measured percent and positive remaining estimate', () => {
    const status = model()!;
    expect(status.title).toBe('Centauri · Printing');
    expect(status.text).toBe('42% · 60 min left');
    expect(printMonitorArguments(status, now)).toEqual([
      'Centauri · Printing',
      '42% · 60 min left',
      42,
      false,
      'Centauri · Disconnected',
      'Last known: 42%',
      66000,
    ]);
  });

  it.each([
    [-10, 0],
    [120, 100],
    [42.4, 42],
  ])('clamps progress %s to %s', (progress, expected) => {
    const status = model([printer({ Progress: progress })])!;
    expect(status.progress).toBe(expected);
    expect(status.text).toContain(`${expected}%`);
    expect(status.indeterminate).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, undefined])(
    'uses indeterminate progress for %s without a false 0%% label',
    progress => {
      const status = model([printer({ Progress: progress })])!;
      expect(status.indeterminate).toBe(true);
      expect(status.text).toContain('Progress unavailable');
      expect(status.text).not.toContain('0%');
      expect(status.offlineText).not.toContain('0%');
    }
  );

  it.each([
    { TotalTicks: NaN },
    { TotalTicks: Infinity },
    { CurrentTicks: NaN },
    { CurrentTicks: Infinity },
    { TotalTicks: 0 },
    { CurrentTicks: 0 },
    { CurrentTicks: -20 },
    { CurrentTicks: 4200 },
    { CurrentTicks: 4300 },
    { Progress: 100 },
  ])('omits unsupported ETA for %j without marking completion', fields => {
    const status = model([printer(fields)])!;
    expect(status.text).not.toContain('min left');
    expect(status.title).toContain('Printing');
    expect(status.title).not.toContain('completed');
  });

  it.each([1, 16, 20])(
    'preserves preparing convention for status %s without pretending to know ETA',
    Status => {
      const status = model([printer({ Status })])!;
      expect(status.title).toBe('Centauri · Preparing');
      expect(status.text).toBe('42%');
    }
  );

  it.each([0, 7, 8, 9])('stops monitoring terminal status %s', Status => {
    expect(model([printer({ Status })])).toBeNull();
  });

  it('keeps unknown nonterminal jobs without inventing their state', () => {
    expect(model([printer({ Status: 99 })])!.title).toBe(
      'Centauri · Print in progress'
    );
  });

  it('stops for removed printers, missing filename or unknown status data', () => {
    expect(model([])).toBeNull();
    expect(model([printer({ Filename: '' })])).toBeNull();
    expect(model([printer({ Status: undefined })])).toBeNull();
    expect(model([printer({}, { status: undefined })])).toBeNull();
  });

  it.each(['disconnected', 'connecting', 'error', 'timeout'] as const)(
    'keeps last-known progress when %s, without ETA',
    connectionStatus => {
      const status = model([printer({}, { connectionStatus })])!;
      expect(status.title).toBe('Centauri · Disconnected');
      expect(status.text).toBe('Last known: 42%');
      expect(printMonitorArguments(status, now)[6]).toBe(0);
    }
  );

  it.each([undefined, NaN, Infinity, -Infinity, 0, -1, now + 1, now - 67000])(
    'does not treat invalid or stale timestamp %s as live',
    lastUpdate => {
      const status = model([printer({}, { lastUpdate })])!;
      expect(status.text).toBe('Last known: 42%');
      expect(status.freshUntil).toBe(0);
    }
  );

  it('allows a legitimate five-minute poll and deducts actual data age', () => {
    const status = model([printer({}, { lastUpdate: now - 300000 })], 300000)!;
    expect(status.text).toContain('min left');
    expect(printMonitorArguments(status, now)[6]).toBe(305000);
    expect(
      model([printer({}, { lastUpdate: now - 605000 })], 300000)!.text
    ).toBe('Last known: 42%');
  });

  it('dedupes equivalent renders but includes real unchanged-progress heartbeats', () => {
    expect(model()!.key).toBe(model([printer()], 31000, now + 5000)!.key);
    expect(model()!.key).not.toBe(
      model([printer({}, { lastUpdate: now })])!.key
    );
    expect(model([printer()], 31000, now + 67000)!.text).toBe(
      'Last known: 42%'
    );
  });

  it('prefers live jobs over disconnected or stale jobs in any list order', () => {
    const live = printer({}, { id: 'live', printerName: 'Saturn' });
    const offline = printer({}, { connectionStatus: 'disconnected' });
    const stale = printer(
      {},
      {
        id: 'stale',
        printerName: 'Stale connected',
        lastUpdate: now - 100000,
      }
    );
    for (const printers of [
      [offline, stale, live],
      [stale, live, offline],
      [live, offline],
    ]) {
      expect(model(printers)!.title).toBe('Saturn · Printing');
    }
    expect(model([offline, stale])!.title).toBe(
      'Stale connected · Disconnected'
    );
    expect(model([printer({ Status: 9 }), live])!.title).toContain('Saturn');
  });

  it('localizes live and native offline fallback strings through the translator', () => {
    const localized = buildPrintMonitorStatus(
      [printer()],
      31000,
      now,
      (key, params) => `localized:${translate(key, params)}`
    )!;
    expect(localized.title).toContain('localized:Printing');
    expect(localized.text).toContain('localized:60 min left');
    expect(localized.offlineTitle).toContain('localized:Disconnected');
    expect(localized.offlineText).toBe('localized:Last known: 42%');
  });
});

const bridge = () => ({
  iniciar: jest.fn().mockResolvedValue(true),
  atualizar: jest.fn().mockResolvedValue(true),
  parar: jest.fn().mockResolvedValue(true),
});
const deferred = () => {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('serialized native monitor updates', () => {
  it('starts once, dedupes payloads, and refreshes unchanged-progress heartbeats', async () => {
    const native = bridge();
    const monitor = createPrintMonitorService(native, jest.fn(), () => now);
    await monitor.set(model());
    await monitor.set(model());
    expect(native.iniciar).toHaveBeenCalledTimes(1);
    expect(native.atualizar).toHaveBeenCalledTimes(1);
    await monitor.set(model([printer({}, { lastUpdate: now })]));
    expect(native.atualizar).toHaveBeenCalledTimes(2);
    expect(native.atualizar.mock.calls[1][6]).toBe(67000);
  });

  it('updates translated strings without restarting the service', async () => {
    const native = bridge();
    const monitor = createPrintMonitorService(native, jest.fn(), () => now);
    await monitor.set(model());
    await monitor.set(
      buildPrintMonitorStatus(
        [printer()],
        31000,
        now,
        key => `translated:${key}`
      )
    );
    expect(native.iniciar).toHaveBeenCalledTimes(1);
    expect(native.atualizar.mock.calls[1][0]).toBe(
      'translated:notifications.monitorTitle'
    );
  });

  it('logs rejected updates and retries the same payload', async () => {
    const native = bridge();
    const error = new Error('bridge unavailable');
    native.atualizar.mockRejectedValueOnce(error);
    const report = jest.fn();
    const monitor = createPrintMonitorService(native, report, () => now);
    await monitor.set(model());
    expect(report).toHaveBeenCalledWith(error);
    await monitor.set(model());
    expect(native.atualizar).toHaveBeenCalledTimes(2);
    expect(native.iniciar).toHaveBeenCalledTimes(1);
  });

  it('logs false native results and retries a failed start', async () => {
    const native = bridge();
    native.iniciar.mockResolvedValueOnce(false);
    const report = jest.fn();
    const monitor = createPrintMonitorService(native, report, () => now);
    await monitor.set(model());
    expect(report).toHaveBeenCalledWith(expect.any(Error));
    expect(native.atualizar).not.toHaveBeenCalled();
    await monitor.set(model());
    expect(native.iniciar).toHaveBeenCalledTimes(2);
    expect(native.atualizar).toHaveBeenCalledTimes(1);
  });

  it('retries failed stops rather than forgetting the running service', async () => {
    const native = bridge();
    native.parar.mockRejectedValueOnce(new Error('stop unavailable'));
    const report = jest.fn();
    const monitor = createPrintMonitorService(native, report, () => now);
    await monitor.set(model());
    await monitor.set(null);
    expect(report).toHaveBeenCalledTimes(1);
    await monitor.set(null);
    expect(native.parar).toHaveBeenCalledTimes(2);
  });

  it('stops after an in-flight start without sending an obsolete update', async () => {
    const native = bridge();
    const start = deferred();
    native.iniciar.mockReturnValueOnce(start.promise);
    const monitor = createPrintMonitorService(native, jest.fn(), () => now);
    const work = monitor.set(model());
    await flush();
    monitor.set(null);
    start.resolve(true);
    await work;
    expect(native.atualizar).not.toHaveBeenCalled();
    expect(native.parar).toHaveBeenCalledTimes(1);
  });

  it('serializes stop behind an in-flight update and restarts a new job afterwards', async () => {
    const native = bridge();
    const update = deferred();
    const stop = deferred();
    native.atualizar.mockReturnValueOnce(update.promise);
    native.parar.mockReturnValueOnce(stop.promise);
    const monitor = createPrintMonitorService(native, jest.fn(), () => now);
    const work = monitor.set(model());
    await flush();
    monitor.set(null);
    expect(native.parar).not.toHaveBeenCalled();
    update.resolve(true);
    await flush();
    expect(native.parar).toHaveBeenCalledTimes(1);
    monitor.set(model([printer({ Progress: 60 })]));
    stop.resolve(true);
    await work;
    expect(native.iniciar).toHaveBeenCalledTimes(2);
    expect(native.atualizar.mock.calls[1][2]).toBe(60);
  });

  it('recalculates remaining freshness after awaiting native start', async () => {
    const native = bridge();
    const start = deferred();
    native.iniciar.mockReturnValueOnce(start.promise);
    let clock = now;
    const monitor = createPrintMonitorService(native, jest.fn(), () => clock);
    const work = monitor.set(model());
    await flush();
    clock += 70000;
    start.resolve(true);
    await work;
    expect(native.atualizar).toHaveBeenCalledWith(
      'Centauri · Disconnected',
      'Last known: 42%',
      42,
      false,
      'Centauri · Disconnected',
      'Last known: 42%',
      0
    );
  });

  it('retains offline jobs, stops on completion/removal, and does not alert separately', async () => {
    const native = bridge();
    const monitor = createPrintMonitorService(native, jest.fn(), () => now);
    await monitor.set(model());
    await monitor.set(
      model([printer({}, { connectionStatus: 'disconnected' })])
    );
    expect(native.parar).not.toHaveBeenCalled();
    await monitor.set(model([printer({ Status: 9 })]));
    expect(native.parar).toHaveBeenCalledTimes(1);
    await monitor.set(model());
    await monitor.set(model([]));
    expect(native.parar).toHaveBeenCalledTimes(2);
  });

  it('does not lose an active job queued directly after a no-op stop', async () => {
    const native = bridge();
    const monitor = createPrintMonitorService(native, jest.fn(), () => now);
    const idle = monitor.set(null);
    const active = monitor.set(model());
    await Promise.all([idle, active]);
    expect(native.atualizar).toHaveBeenCalledTimes(1);
    expect(native.parar).not.toHaveBeenCalled();
  });
});
