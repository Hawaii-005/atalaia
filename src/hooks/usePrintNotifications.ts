import { enderecoDe } from '../utils/rede';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getPrintStatus, Printer, PrintStatus } from '../types';
import { finishRecord, startRecord } from '../utils/printHistory';
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
  // A pausa não muda o código de estado: o sinal é o CurrentTicks parar.
  // Só se conclui pausa com duas leituras seguidas iguais e mais de 45 s
  // parados, e só com a app à frente — em segundo plano o socket adormece e
  // os ticks ficam «parados» sem a máquina ter pausado nada.
  const ticksRef = useRef<Record<string, { valor: number; desde: number; iguais: number }>>({});

  useEffect(() => {
    loadNotificationPrefs().then(setPrefs);
  }, []);

  // Ao voltar ao primeiro plano esquece-se a contagem: a leitura que chega
  // pode ser a última de antes de o Android suspender o socket.
  useEffect(() => {
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') ticksRef.current = {};
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    printers.forEach(printer => {
      const info = printer.status?.PrintInfo;
      const rawStatus = info?.Status;
      const connected = printer.connectionStatus === 'connected';
      const previous = snapshotRef.current[printer.id];

      const statusBase =
        rawStatus === undefined ? previous?.status ?? 'idle' : getPrintStatus(rawStatus);

      const emPrimeiroPlano = AppState.currentState === 'active';
      const ticksAtuais = info?.CurrentTicks ?? 0;
      const agora = Date.now();
      const anterior = ticksRef.current[printer.id];
      if (!anterior || anterior.valor !== ticksAtuais) {
        ticksRef.current[printer.id] = { valor: ticksAtuais, desde: agora, iguais: 0 };
      } else if (emPrimeiroPlano) {
        anterior.iguais += 1;
      }
      const marco = ticksRef.current[printer.id];
      const paradoDesde = marco?.desde ?? agora;
      const emPausa =
        connected &&
        emPrimeiroPlano &&
        statusBase === 'printing' &&
        ticksAtuais > 0 &&
        (marco?.iguais ?? 0) >= 2 &&
        agora - paradoDesde > 45000;

      const status: PrintStatus = emPausa ? 'paused' : statusBase;
      const progress = info?.Progress ?? 0;
      const filename = info?.Filename || 'your print';

      const nowPrinting = status === 'printing';
      const wasPrinting = previous?.status === 'printing';

      if (connected && nowPrinting && !wasPrinting) {
        startRecord({
          printerName: printer.printerName,
          printerIp: enderecoDe(printer),
          filename,
          totalLayers: info?.TotalLayer,
          outcome: 'printing',
        });
      }

      // Fecha também quando a app arranca já com a máquina parada: pode haver
      // um registo aberto de uma sessão anterior (o fim aconteceu com a app
      // fechada). Sem isto, o histórico ficava com um «A imprimir» eterno.
      if (connected && !nowPrinting && (wasPrinting || !previous)) {
        if (status === 'completed') {
          finishRecord(printer.printerName, 'completed', info?.CurrentLayer);
        } else if (status === 'stopped') {
          finishRecord(printer.printerName, 'stopped', info?.CurrentLayer);
        } else {
          finishRecord(printer.printerName, 'unknown', info?.CurrentLayer, !wasPrinting);
        }
      }

      // Máquina desligada ou fora da rede com um registo aberto: o fim não foi
      // visto. Fecha-se como «sem confirmação», sem hora de fim inventada —
      // senão ficava a contar dias a fio no histórico.
      if (!connected && !previous) {
        finishRecord(printer.printerName, 'unknown', undefined, true);
      }

      if (previous) {
        // Connection lost mid-print.
        // Uma perda de ligação enquanto a app está em segundo plano é normal
        // (o Android suspende o socket): não vale a pena avisar. Só se avisa
        // com a app à frente e com um trabalho a decorrer.
        const appAVista = AppState.currentState === 'active';
        if (
          prefs.offline &&
          appAVista &&
          previous.connected &&
          !connected &&
          previous.status === 'printing'
        ) {
          notify(
            'Impressora desligada',
            `${printer.printerName} perdeu a ligação à rede a imprimir.`,
            { printerId: printer.id }
          );
        }

        if (connected && previous.status !== status) {
          if (status === 'completed' && prefs.finished) {
            notify(
              'Impressão terminada',
              `${printer.printerName} concluiu ${filename}.`,
              { printerId: printer.id }
            );
          }
          if (status === 'paused' && prefs.paused) {
            notify(
              'Impressão em pausa',
              `${printer.printerName} pausou ${filename}.`,
              { printerId: printer.id },
              'em-pausa',
              enderecoDe(printer)
            );
          }
          if (status === 'stopped' && prefs.paused) {
            notify(
              'Impressão parada',
              `${printer.printerName} parou ${filename}.`,
              { printerId: printer.id },
              'em-curso',
              enderecoDe(printer)
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
                `${mark}% impressos`,
                `${printer.printerName} chegou aos ${mark}%.`,
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
