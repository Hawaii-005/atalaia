/**
 * Máquina de estados do envio. Pura: recebe estado e evento, devolve estado.
 * Quem chama é que faz a rede — e só depois de a máquina dizer que pode.
 */

import type { ErroEnvio, Estado, Saida } from './tipos';

/**
 * Saídas de cada erro. `fila` nunca passa por `aEnviar`: pôr na fila é um item
 * local, não um envio adiado.
 */
export const SAIDAS: Record<ErroEnvio, Saida[]> = {
  ocupada: ['fila', 'resultado'],
  autenticacao: ['credenciais', 'resultado'],
  semEspaco: ['resultado'],
  timeout: ['repetir', 'fila', 'resultado'],
  inconsistente: ['repetir', 'resultado'],
  arranqueFalhou: ['repetir', 'resultado'],
  cancelado: ['resultado'],
};

export const chaveErro = (erro: ErroEnvio): string => `envio.erro.${erro}`;

/** O Moonraker extrai metadados depois de aceitar o upload (404 no início). */
export const TENTATIVAS_VERIFICACAO = 5;
export const LIMITE_VERIFICACAO_MS = 8000;

export const podeRepetirLeitura = (
  tentativa: number,
  decorridoMs: number
): boolean =>
  tentativa < TENTATIVAS_VERIFICACAO && decorridoMs < LIMITE_VERIFICACAO_MS;

export type Evento =
  | { tipo: 'enviar'; total: number }
  | { tipo: 'progresso'; enviado: number }
  | { tipo: 'uploadOk'; remoto: string }
  | { tipo: 'falhaUpload'; erro: ErroEnvio }
  | { tipo: 'cancelar' }
  | { tipo: 'verificar'; agora: number }
  | { tipo: 'metadadosAusentes'; agora: number }
  | { tipo: 'metadadosLidos'; igual: boolean }
  | { tipo: 'arrancar' }
  | { tipo: 'arranqueOk' }
  | { tipo: 'arranqueFalhou' }
  | { tipo: 'repor' };

export const inicial: Estado = { fase: 'pronto' };

const falhou = (
  erro: ErroEnvio,
  de:
    | 'pronto'
    | 'aEnviar'
    | 'enviado'
    | 'aVerificar'
    | 'verificado'
    | 'aArrancar',
  remoto?: string
): Estado => ({
  fase: 'falhou',
  erro,
  de,
  ...(remoto ? { remoto } : {}),
});

/**
 * Aplica um evento. Eventos fora de tempo (duplo toque, resposta tardia) são
 * ignorados — `aplicado: false` — e nunca mexem no estado.
 */
export const transitar = (
  estado: Estado,
  evento: Evento
): { estado: Estado; aplicado: boolean } => {
  if (evento.tipo === 'repor') {
    return estado.fase === 'iniciado'
      ? { estado, aplicado: false }
      : { estado: inicial, aplicado: true };
  }

  switch (estado.fase) {
    case 'pronto':
      if (evento.tipo === 'enviar' && evento.total > 0) {
        return {
          estado: { fase: 'aEnviar', enviado: 0, total: evento.total },
          aplicado: true,
        };
      }
      break;

    case 'aEnviar':
      if (evento.tipo === 'progresso') {
        const enviado = Math.min(
          Math.max(evento.enviado, estado.enviado),
          estado.total
        );
        return { estado: { ...estado, enviado }, aplicado: true };
      }
      if (evento.tipo === 'uploadOk') {
        return {
          estado: { fase: 'enviado', remoto: evento.remoto },
          aplicado: true,
        };
      }
      if (evento.tipo === 'falhaUpload') {
        return { estado: falhou(evento.erro, 'aEnviar'), aplicado: true };
      }
      if (evento.tipo === 'cancelar') {
        return { estado: falhou('cancelado', 'aEnviar'), aplicado: true };
      }
      break;

    case 'enviado':
      if (evento.tipo === 'verificar') {
        return {
          estado: {
            fase: 'aVerificar',
            remoto: estado.remoto,
            tentativa: 1,
            desde: evento.agora,
          },
          aplicado: true,
        };
      }
      if (evento.tipo === 'cancelar') {
        return {
          estado: falhou('cancelado', 'enviado', estado.remoto),
          aplicado: true,
        };
      }
      break;

    case 'aVerificar':
      if (evento.tipo === 'metadadosAusentes') {
        const decorrido = evento.agora - estado.desde;
        return podeRepetirLeitura(estado.tentativa, decorrido)
          ? {
              estado: { ...estado, tentativa: estado.tentativa + 1 },
              aplicado: true,
            }
          : {
              estado: falhou('inconsistente', 'aVerificar', estado.remoto),
              aplicado: true,
            };
      }
      if (evento.tipo === 'metadadosLidos') {
        return evento.igual
          ? {
              estado: { fase: 'verificado', remoto: estado.remoto },
              aplicado: true,
            }
          : {
              estado: falhou('inconsistente', 'aVerificar', estado.remoto),
              aplicado: true,
            };
      }
      break;

    case 'verificado':
      if (evento.tipo === 'arrancar') {
        return {
          estado: { fase: 'aArrancar', remoto: estado.remoto },
          aplicado: true,
        };
      }
      break;

    case 'aArrancar':
      if (evento.tipo === 'arranqueOk') {
        return {
          estado: { fase: 'iniciado', remoto: estado.remoto },
          aplicado: true,
        };
      }
      if (evento.tipo === 'arranqueFalhou') {
        return {
          estado: falhou('arranqueFalhou', 'aArrancar', estado.remoto),
          aplicado: true,
        };
      }
      break;

    case 'iniciado':
    case 'falhou':
      break;
  }

  return { estado, aplicado: false };
};

/** Progresso em percentagem inteira (0–100); 0 quando não há envio a decorrer. */
export const percentagem = (estado: Estado): number =>
  estado.fase === 'aEnviar' && estado.total > 0
    ? Math.round((estado.enviado / estado.total) * 100)
    : estado.fase === 'pronto'
      ? 0
      : estado.fase === 'falhou' && estado.de === 'aEnviar'
        ? 0
        : 100;
