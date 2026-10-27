import { getPrintStatus, Printer } from '../types';

type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export interface PrintMonitorStatus {
  key: string;
  title: string;
  text: string;
  progress: number;
  indeterminate: boolean;
  offlineTitle: string;
  offlineText: string;
  freshUntil: number;
}

export const buildPrintMonitorStatus = (
  printers: Printer[],
  statusIntervalMs: number,
  now: number,
  translate: Translate
): PrintMonitorStatus | null => {
  const freshnessMs = Math.max(
    30000,
    (Number.isFinite(statusIntervalMs) && statusIntervalMs > 0
      ? statusIntervalMs
      : 31000) *
      2 +
      5000
  );
  const candidates = printers.flatMap(printer => {
    const info = printer.status?.PrintInfo;
    if (!info?.Filename || !Number.isFinite(info.Status)) return [];
    const state = getPrintStatus(info.Status);
    if (['idle', 'stopped', 'completed'].includes(state)) return [];
    const timestamp = printer.lastUpdate;
    const validTimestamp =
      typeof timestamp === 'number' &&
      Number.isFinite(timestamp) &&
      timestamp > 0 &&
      timestamp <= now;
    const deadline = validTimestamp ? timestamp + freshnessMs : 0;
    const live = printer.connectionStatus === 'connected' && deadline > now;
    return [{ printer, info, state, live, deadline }];
  });
  // Keep selection stable, but prefer genuinely live jobs over last-known ones.
  const selected =
    candidates.find(candidate => candidate.live) ??
    candidates.find(
      candidate => candidate.printer.connectionStatus === 'connected'
    ) ??
    candidates[0];
  if (!selected) return null;

  const { printer, info, state, live, deadline } = selected;
  const indeterminate = !Number.isFinite(info.Progress);
  const progress = indeterminate
    ? 0
    : Math.round(Math.max(0, Math.min(100, info.Progress)));
  const progressText = indeterminate
    ? translate('notifications.monitorProgressUnknown')
    : `${progress}%`;
  const offlineTitle = translate('notifications.monitorTitle', {
    nome: printer.printerName,
    estado: translate('comum.desligada'),
  });
  const offlineText = translate('notifications.monitorLastKnown', {
    progresso: progressText,
  });
  const stateKey =
    state === 'printing'
      ? 'comum.aImprimir'
      : state === 'preparing'
        ? 'comum.aPreparar'
        : 'notifications.monitorActive';
  const title = live
    ? translate('notifications.monitorTitle', {
        nome: printer.printerName,
        estado: translate(stateKey),
      })
    : offlineTitle;
  let text = live ? progressText : offlineText;
  const remaining = info.TotalTicks - info.CurrentTicks;
  if (
    live &&
    state === 'printing' &&
    Number.isFinite(info.TotalTicks) &&
    Number.isFinite(info.CurrentTicks) &&
    info.TotalTicks > 0 &&
    info.CurrentTicks > 0 &&
    remaining > 0 &&
    progress < 100
  ) {
    text += ` · ${translate('notifications.monitorEta', {
      n: Math.ceil(remaining / 60),
    })}`;
  }
  const status = {
    title,
    text,
    progress,
    indeterminate,
    offlineTitle,
    offlineText,
    freshUntil: live ? deadline : 0,
  };
  return {
    ...status,
    // A real status heartbeat resets the native stale timer even at the same %.
    key: JSON.stringify([printer.id, printer.lastUpdate, status]),
  };
};

export const printMonitorArguments = (
  status: PrintMonitorStatus,
  now: number
): [string, string, number, boolean, string, string, number] => {
  const remaining = Math.max(0, status.freshUntil - now);
  return [
    remaining > 0 ? status.title : status.offlineTitle,
    remaining > 0 ? status.text : status.offlineText,
    status.progress,
    status.indeterminate,
    status.offlineTitle,
    status.offlineText,
    remaining,
  ];
};
