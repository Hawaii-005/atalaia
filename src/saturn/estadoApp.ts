// Tradução do estado da resina (SDCP V1) para o formato que o resto da app já
// conhece (PrinterStatus/PrintInfo). Assim os ecrãs existentes continuam a
// funcionar sem saber que há duas famílias de impressoras.

import { PrinterStatus } from '../types';
import { EstadoResina } from './ligacao';

/**
 * Códigos do `PrintInfo.Status` da Saturn (medidos na firmware 1.5.4):
 * 0 repouso, 2–7 fases de impressão, 8 pausa, 10 a parar, 14 parada,
 * 16 concluída. O 13 aparece em plena impressão (visto na Centauri a 1/22
 * camadas) e fica no PrintInfo depois de parar — por isso, em repouso, quem
 * manda é o `CurrentStatus`.
 */
export const codigoParaApp = (status: number, currentStatus = 0): number => {
  // Máquina em repouso (cs 0): manda o CurrentStatus. O PrintInfo fica com o
  // último trabalho e sem isto a app mostrava «A imprimir» ou «Parada» numa
  // Saturn pronta a imprimir.
  if (currentStatus === 0) return 0;
  if (status === 0) return 0;
  // 8 = em pausa (medido: carregar em Pausa no ecrã da máquina põe o
  // PrintInfo.Status a 8 e os ticks param; ao retomar volta a 2/3/4).
  if (status === 8) return 20;
  if (status === 20) return 20;
  if (status === 10 || status === 14) return 8;
  if (status === 16) return 9;
  if (status >= 1 && status <= 15) return 6;
  return 8;
};

const progresso = (camada: number, total: number, status: number): number => {
  if (status === 9) return 100;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((camada / total) * 100)));
};

/** Os ticks da Saturn vêm em milissegundos; a app trabalha em segundos. */
const segundos = (ticks: number): number => Math.max(0, Math.round(ticks / 1000));

export const estadoParaApp = (estado: EstadoResina): PrinterStatus => {
  const info = estado.PrintInfo;
  const codigo = codigoParaApp(info.Status, estado.CurrentStatus);
  return {
    CurrentStatus: [estado.CurrentStatus],
    TimeLapseStatus: 0,
    PlatFormType: 0,
    TempOfHotbed: 0,
    TempOfNozzle: 0,
    TempOfBox: 0,
    TempTargetHotbed: 0,
    TempTargetNozzle: 0,
    TempTargetBox: 0,
    CurrenCoord: '',
    CurrentFanSpeed: { ModelFan: 0, AuxiliaryFan: 0, BoxFan: 0 },
    ZOffset: 0,
    LightStatus: { SecondLight: 0, RgbLight: [0, 0, 0] },
    PrintInfo: {
      Status: codigo,
      CurrentLayer: info.CurrentLayer,
      TotalLayer: info.TotalLayer,
      CurrentTicks: segundos(info.CurrentTicks),
      TotalTicks: segundos(info.TotalTicks),
      Filename: info.Filename,
      TaskId: '',
      PrintSpeedPct: 0,
      Progress: progresso(info.CurrentLayer, info.TotalLayer, codigo),
      // Sem isto a recusa de um ficheiro ficava invisível na app.
      ErrorNumber: info.ErrorNumber ?? 0,
    },
  };
};
