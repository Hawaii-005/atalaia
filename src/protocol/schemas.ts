import { SdcpResponse } from './types';
import { log } from '../utils/log';

/**
 * Valida a estrutura básica de uma mensagem SDCP recebida.
 * Devolve o pacote validado ou null se a mensagem for inválida.
 */
export function validarMensagemSdcp(jsonBruto: unknown): SdcpResponse | null {
  if (typeof jsonBruto !== 'object' || jsonBruto === null) {
    log('protocol/schema: mensagem não é objeto', jsonBruto);
    return null;
  }

  const obj = jsonBruto as Record<string, unknown>;

  if (typeof obj.Id !== 'string') {
    log('protocol/schema: Id ausente ou inválido', jsonBruto);
    return null;
  }

  if (typeof obj.Data !== 'object' || obj.Data === null) {
    log('protocol/schema: Data ausente ou inválido', jsonBruto);
    return null;
  }

  const data = obj.Data as Record<string, unknown>;

  if (typeof data.Cmd !== 'number' || isNaN(data.Cmd)) {
    log('protocol/schema: Cmd numérico ausente', jsonBruto);
    return null;
  }

  return {
    Id: obj.Id,
    Data: {
      Cmd: data.Cmd,
      Data: data.Data,
      Ack: typeof data.Ack === 'number' ? data.Ack : undefined,
      RequestID:
        typeof data.RequestID === 'string' ? data.RequestID : undefined,
      MainboardID:
        typeof data.MainboardID === 'string' ? data.MainboardID : undefined,
      TimeStamp:
        typeof data.TimeStamp === 'number' ? data.TimeStamp : undefined,
    },
  };
}

/** Tenta fazer parse e validar uma string JSON da impressora. */
export function parseEValidarSdcp(texto: string): SdcpResponse | null {
  try {
    const parsed = JSON.parse(texto);
    return validarMensagemSdcp(parsed);
  } catch (erro) {
    log('protocol/schema: JSON malformado ignorado', erro);
    return null;
  }
}
