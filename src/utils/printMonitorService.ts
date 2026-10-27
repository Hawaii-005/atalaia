import {
  PrintMonitorStatus,
  printMonitorArguments,
} from './printMonitorStatus';

interface MonitorService {
  iniciar: (title: string, text: string) => Promise<boolean>;
  atualizar: (
    ...args: ReturnType<typeof printMonitorArguments>
  ) => Promise<boolean>;
  parar: () => Promise<boolean>;
}

export const createPrintMonitorService = (
  service: MonitorService,
  reportError: (error: unknown) => void,
  now: () => number = Date.now
) => {
  let desired: PrintMonitorStatus | null = null;
  let pending = false;
  let draining: Promise<void> | null = null;
  let started = false;
  let needsStop = false;
  let appliedKey: string | null = null;

  const drain = async () => {
    while (pending) {
      pending = false;
      const next = desired;
      try {
        if (!next) {
          if (needsStop) {
            if ((await service.parar()) === false) {
              throw new Error('Print monitor stop was rejected');
            }
            started = false;
            needsStop = false;
            appliedKey = null;
          }
          continue;
        }
        if (started && appliedKey === next.key) continue;
        if (!started) {
          needsStop = true;
          const args = printMonitorArguments(next, now());
          if ((await service.iniciar(args[0], args[1])) === false) {
            throw new Error('Print monitor start was rejected');
          }
          started = true;
        }
        // A stop or newer printer snapshot may have arrived while starting.
        if (desired !== next) continue;
        if (
          (await service.atualizar(...printMonitorArguments(next, now()))) ===
          false
        ) {
          throw new Error('Print monitor update was rejected');
        }
        appliedKey = next.key;
      } catch (error) {
        appliedKey = null;
        if (!next) started = false;
        reportError(error);
      }
    }
  };

  const run = (): Promise<void> => {
    if (!draining) {
      draining = Promise.resolve()
        .then(drain)
        .finally(() => {
          draining = null;
          if (pending) return run();
        });
    }
    return draining;
  };

  return {
    set(status: PrintMonitorStatus | null): Promise<void> {
      desired = status;
      pending = true;
      return run();
    },
  };
};
