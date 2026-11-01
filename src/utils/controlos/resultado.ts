/**
 * Resultado de um comando, a partir do Ack do SDCP.
 *
 * O protocolo responde `Ack` dentro de `Data`. `0` é aceite; `3` é o único
 * código que a app já interpretava (precisa de Home). Tudo o resto é erro — e
 * um erro fica visível, porque é a única forma de o utilizador saber que o
 * toque não fez nada.
 */

export type ResultadoComando =
  | { estado: 'ok' }
  | { estado: 'aviso'; motivo: 'precisa-home' }
  | { estado: 'erro'; motivo: 'ack' | 'timeout'; ack?: number };

/** Tempo máximo à espera de Ack antes de desistir. */
export const ESPERA_ACK_MS = 8000;

export const resultadoDeAck = (ack: number | null): ResultadoComando => {
  // Sem Ack legível é o mesmo que não ter resposta: não se assume sucesso.
  if (ack === null) return { estado: 'erro', motivo: 'timeout' };
  if (ack === 0) return { estado: 'ok' };
  if (ack === 3) return { estado: 'aviso', motivo: 'precisa-home' };
  return { estado: 'erro', motivo: 'ack', ack };
};

export const resultadoDeFalha = (_erro: unknown): ResultadoComando => ({
  estado: 'erro',
  motivo: 'timeout',
});
