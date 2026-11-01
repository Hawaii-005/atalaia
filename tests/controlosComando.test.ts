import {
  executarComando,
  ResultadoComando,
} from '../src/utils/controlos/resultado';

/** Cliente SDCP falso: cada caso devolve o que a impressora devolveria. */
const cliente =
  (resposta: unknown, falha = false) =>
  async (_cmd: unknown): Promise<unknown> => {
    if (falha) throw new Error('ligação caiu');
    return resposta;
  };

const correr = async (
  enviar: (cmd: unknown) => Promise<unknown>
): Promise<ResultadoComando> => executarComando(enviar, { Cmd: 401 });

describe('executarComando com cliente falso', () => {
  it('Ack 0 → feito', async () => {
    await expect(correr(cliente({ Ack: 0 }))).resolves.toEqual({
      estado: 'ok',
    });
  });

  it('Ack 3 → aviso de Home', async () => {
    await expect(correr(cliente({ Ack: 3 }))).resolves.toEqual({
      estado: 'aviso',
      motivo: 'precisa-home',
    });
  });

  it('Ack 5 → recusado com código', async () => {
    await expect(correr(cliente({ Ack: 5 }))).resolves.toEqual({
      estado: 'erro',
      motivo: 'ack',
      ack: 5,
    });
  });

  it('resposta sem Ack → sem resposta, nunca sucesso', async () => {
    await expect(correr(cliente({}))).resolves.toEqual({
      estado: 'erro',
      motivo: 'timeout',
    });
  });

  it('timeout a meio do comando → erro, sem repetir', async () => {
    await expect(correr(cliente(null, true))).resolves.toEqual({
      estado: 'erro',
      motivo: 'timeout',
    });
  });

  it('perda de ligação depois de enviar → erro', async () => {
    const enviar = async () => {
      throw new Error('socket fechado');
    };
    await expect(correr(enviar)).resolves.toEqual({
      estado: 'erro',
      motivo: 'timeout',
    });
  });
});
