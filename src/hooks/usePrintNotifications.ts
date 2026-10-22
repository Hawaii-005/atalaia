import { useEffect, useRef, useState } from 'react';
import { getPrintStatus, Printer, PrintStatus } from '../types';
import {
  DEFAULT_PREFS,
  NotificationPrefs,
  loadNotificationPrefs,
  notify,
} from '../utils/notifications';

interface Snapshot {
  status: PrintStatus;
  progress: number;
  filename: string;
  connected: boolean;
}

const MILESTONES = [50, 90];

/**
 * Watches printer state transitions and raises local notifications.
 * Only transitions are reported, so a status refresh every 30s stays silent.
 */
export const usePrintNotifications = (printers: Printer[]) => {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const snapshotRef = useRef<Record<string, Snapshot>>({});

  useEffect(() => {
    loadNotificationPrefs().then(setPrefs);
  }, []);

  useEffect(() => {
    printers.forEach(printer => {
      const info = printer.status?.PrintInfo;
      const rawStatus = info?.Status;
      const connected = printer.connectionStatus === 'connected';
      const previous = snapshotRef.current[printer.id];

      const status =
        rawStatus === undefined ? previous?.status ?? 'idle' : getPrintStatus(rawStatus);
      const progress = info?.Progress ?? 0;
      const filename = info?.Filename || 'your print';

      if (previous) {
        // Connection lost mid-print.
        if (
          prefs.offline &&
          previous.connected &&
          !connected &&
          previous.status === 'printing'
        ) {
          notify(
            'Printer offline',
            `${printer.printerName} dropped off the network while printing.`,
            { printerId: printer.id }
          );
        }

        if (connected && previous.status !== status) {
          if (status === 'completed' && prefs.finished) {
            notify(
              'Print finished',
              `${printer.printerName} completed ${filename}.`,
              { printerId: printer.id }
            );
          }
          if (status === 'paused' && prefs.paused) {
            notify('Print paused', `${printer.printerName} paused ${filename}.`, {
              printerId: printer.id,
            });
          }
          if (status === 'stopped' && prefs.paused) {
            notify(
              'Print stopped',
              `${printer.printerName} stopped ${filename}.`,
              { printerId: printer.id }
            );
          }
        }

        if (
          prefs.milestones &&
          connected &&
          status === 'printing' &&
          progress > previous.progress
        ) {
          MILESTONES.forEach(mark => {
            if (previous.progress < mark && progress >= mark) {
              notify(
                `${mark}% printed`,
                `${printer.printerName} reached ${mark}%.`,
                { printerId: printer.id }
              );
            }
          });
        }
      }

      snapshotRef.current[printer.id] = {
        status,
        progress,
        filename,
        connected,
      };
    });
  }, [printers, prefs]);

  return { prefs, setPrefs };
};
