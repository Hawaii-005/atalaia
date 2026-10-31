import {
  parseEValidarSdcp,
  validarMensagemSdcp,
} from '../src/protocol/schemas';

describe('Validação de Schemas SDCP', () => {
  it('aceita e valida mensagem com estrutura correta', () => {
    const valida = {
      Id: 'req-1',
      Data: {
        Cmd: 0,
        Data: { Status: 1 },
        Ack: 0,
      },
    };
    const res = validarMensagemSdcp(valida);
    expect(res).not.toBeNull();
    expect(res?.Id).toBe('req-1');
    expect(res?.Data.Cmd).toBe(0);
  });

  it('rejeita mensagens malformadas sem crashar', () => {
    expect(validarMensagemSdcp(null)).toBeNull();
    expect(validarMensagemSdcp('string')).toBeNull();
    expect(validarMensagemSdcp({ Id: 123 })).toBeNull();
    expect(validarMensagemSdcp({ Id: '1', Data: 'invalid' })).toBeNull();
    expect(parseEValidarSdcp('json invalido{')).toBeNull();
  });
});
