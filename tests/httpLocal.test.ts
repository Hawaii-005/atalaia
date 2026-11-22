/**
 * O salto do 302 é decidido aqui: o módulo nativo devolve o 3xx sem o seguir.
 * Um redirect para fora da rede privada tem de ser recusado, não seguido.
 */
const pedirJson = jest.fn();

jest.mock(
  'react-native',
  () => ({ NativeModules: { HttpLocal: { pedirJson } } }),
  {
    virtual: true,
  }
);

import { pedirJsonLocal } from '../src/utils/httpLocal';

describe('redirect em rede privada', () => {
  beforeEach(() => pedirJson.mockReset());

  it('302 para um endereço público é recusado', async () => {
    pedirJson.mockResolvedValue({
      status: 302,
      location: 'http://example.com/',
    });
    await expect(pedirJsonLocal('http://192.168.1.50/')).rejects.toThrow(
      'redirect_fora_da_rede'
    );
    // Não houve segunda chamada: o destino público nunca foi pedido.
    expect(pedirJson).toHaveBeenCalledTimes(1);
  });

  it('302 para outro IP privado é seguido e devolve o JSON', async () => {
    pedirJson
      .mockResolvedValueOnce({ status: 302, location: 'http://192.168.1.51/x' })
      .mockResolvedValueOnce({ status: 200, body: '{"ok":true}' });
    await expect(pedirJsonLocal('http://192.168.1.50/')).resolves.toEqual({
      ok: true,
    });
    expect(pedirJson).toHaveBeenCalledTimes(2);
    expect(pedirJson).toHaveBeenLastCalledWith('http://192.168.1.51/x', 4000);
  });

  it('não segue 3xx sem Location', async () => {
    pedirJson.mockResolvedValue({ status: 302, location: null });
    await expect(pedirJsonLocal('http://192.168.1.50/')).rejects.toThrow(
      'redirect_sem_destino'
    );
  });
});
