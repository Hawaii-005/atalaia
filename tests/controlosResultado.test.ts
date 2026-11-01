import {
  resultadoDeAck,
  resultadoDeFalha,
} from '../src/utils/controlos/resultado';

describe('resultado de um comando', () => {
  it('Ack 0 é sucesso', () => {
    expect(resultadoDeAck(0)).toEqual({ estado: 'ok' });
  });

  it('Ack 3 pede Home, sem tratar como falha', () => {
    expect(resultadoDeAck(3)).toEqual({
      estado: 'aviso',
      motivo: 'precisa-home',
    });
  });

  it('outros Acks são recusa com o código', () => {
    expect(resultadoDeAck(1)).toEqual({
      estado: 'erro',
      motivo: 'ack',
      ack: 1,
    });
    expect(resultadoDeAck(2)).toEqual({
      estado: 'erro',
      motivo: 'ack',
      ack: 2,
    });
  });

  it('sem Ack legível não se assume sucesso', () => {
    expect(resultadoDeAck(null)).toEqual({ estado: 'erro', motivo: 'timeout' });
  });

  it('uma exceção vira erro de resposta', () => {
    expect(resultadoDeFalha(new Error('x'))).toEqual({
      estado: 'erro',
      motivo: 'timeout',
    });
  });
});
