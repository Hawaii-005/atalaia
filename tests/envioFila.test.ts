import { criarItem, transitar, type ItemFila } from '../src/utils/fila/modelo';
import { proximoAEnviar } from '../src/envio/filaLocal';

const item = (id: string, estado: ItemFila['estado'], printerId = 'p1') => {
  const base = criarItem({
    id,
    printerId,
    name: `${id}.gcode`,
    label: id,
    agora: Number(id.replace(/\D/g, '')) || 1,
    opcoes: { nivelar: false, lado: 0 },
  });
  return estado === 'pendente' ? base : { ...base, estado };
};

describe('vez da fila local', () => {
  test('sem itens não há nada a enviar', () => {
    expect(proximoAEnviar([], 'p1')).toBeNull();
  });

  test('o primeiro pendente é o próximo', () => {
    const fila = [item('a1', 'pendente'), item('a2', 'pendente')];
    expect(proximoAEnviar(fila, 'p1')?.id).toBe('a1');
  });

  test('com trabalho em curso não é a vez de mais ninguém', () => {
    const fila = [item('a1', 'aEnviar'), item('a2', 'pendente')];
    expect(proximoAEnviar(fila, 'p1')).toBeNull();
  });

  test('um item a imprimir também trava a fila', () => {
    expect(
      proximoAEnviar([item('a1', 'aImprimir'), item('a2', 'pendente')], 'p1')
    ).toBeNull();
  });

  test('itens de outra impressora não travam esta', () => {
    const fila = [item('b1', 'aImprimir', 'p2'), item('a1', 'pendente', 'p1')];
    expect(proximoAEnviar(fila, 'p1')?.id).toBe('a1');
  });

  test('um item bloqueado não impede o seguinte', () => {
    const fila = [item('a1', 'bloqueado'), item('a2', 'pendente')];
    expect(proximoAEnviar(fila, 'p1')?.id).toBe('a2');
  });

  test('pôr na fila não mexe no estado: criarItem fica pendente', () => {
    const novo = criarItem({
      id: 'a9',
      printerId: 'p1',
      name: 'a9.gcode',
      label: 'a9',
      agora: 9,
      opcoes: { nivelar: false, lado: 0 },
    });
    expect(novo.estado).toBe('pendente');
    expect(proximoAEnviar([novo], 'p1')?.id).toBe('a9');
  });

  test('a Fila SDCP mantém-se: transitar não é tocado por este módulo', () => {
    const aEnviar = transitar(item('a1', 'pendente'), 'aEnviar', 10);
    expect(aEnviar.estado).toBe('aEnviar');
    expect(proximoAEnviar([aEnviar], 'p1')).toBeNull();
  });
});
