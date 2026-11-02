import { Capabilities, FirmwareFlavor, PrinterKind } from '../types';

export const CAPABILITIES_SDCP_FDM: Capabilities = {
  telemetria: true,
  temperaturas: true,
  camara: true,
  ficheiros: true,
  miniaturas: true,
  uploadFicheiro: true,
  controloImpressao: true,
  movimentoEixos: true,
  home: true,
  luz: true,
  ventoinhas: true,
  velocidade: true,
  babyStepping: false,
  canvasAfc: true,
  consolaGcode: false,
  macrosFilamento: false,
  timelapseSdcp: true,
};

export const CAPABILITIES_MOONRAKER_COSMOS: Capabilities = {
  telemetria: true,
  temperaturas: true,
  camara: true,
  ficheiros: true,
  miniaturas: true,
  uploadFicheiro: true,
  controloImpressao: true,
  movimentoEixos: true,
  home: true,
  luz: true,
  ventoinhas: true,
  velocidade: true,
  babyStepping: true,
  canvasAfc: true, // AFC Klipper extension
  consolaGcode: true,
  macrosFilamento: true,
  timelapseSdcp: false,
};

export const CAPABILITIES_SDCP_RESIN: Capabilities = {
  telemetria: true,
  temperaturas: false,
  camara: false,
  ficheiros: true,
  miniaturas: true,
  uploadFicheiro: true,
  controloImpressao: true,
  movimentoEixos: false,
  home: false,
  luz: false,
  ventoinhas: false,
  velocidade: false,
  babyStepping: false,
  canvasAfc: false,
  consolaGcode: false,
  macrosFilamento: false,
  timelapseSdcp: false,
};

export function obterCapacidades(
  kind: PrinterKind = 'fdm',
  firmware: FirmwareFlavor = 'sdcp'
): Capabilities {
  if (kind === 'resin') {
    return CAPABILITIES_SDCP_RESIN;
  }
  if (firmware === 'moonraker') {
    return CAPABILITIES_MOONRAKER_COSMOS;
  }
  return CAPABILITIES_SDCP_FDM;
}
