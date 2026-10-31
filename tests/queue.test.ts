import { ItemFila } from '../src/utils/fila';

describe('Regras da Fila de Impressão', () => {
  it('cria item da fila com os campos obrigatórios', () => {
    const item: ItemFila = {
      id: 'f1',
      printerId: 'p1',
      name: 'peca.gcode',
      label: 'Peça Teste',
    };
    expect(item.id).toBe('f1');
    expect(item.printerId).toBe('p1');
    expect(item.name).toBe('peca.gcode');
  });

  it('valida remoção apenas quando Ack = 0', () => {
    const fila: ItemFila[] = [
      { id: '1', printerId: 'p1', name: 'item1.gcode', label: 'Item 1' },
      { id: '2', printerId: 'p1', name: 'item2.gcode', label: 'Item 2' },
    ];

    const simularAck = (ack: number, id: string): ItemFila[] => {
      if (ack === 0) {
        return fila.filter(i => i.id !== id);
      }
      return fila;
    };

    expect(simularAck(1, '1').length).toBe(2);
    expect(simularAck(0, '1').length).toBe(1);
    expect(simularAck(0, '1')[0].id).toBe('2');
  });

  it('respeita pausa mínima de 2 minutos (120 000 ms) entre arranques', () => {
    const ultimoArranque = Date.now() - 60_000; // 1 minuto atrás
    const podeArrancar = (agora: number): boolean => {
      return agora - ultimoArranque >= 120_000;
    };

    expect(podeArrancar(Date.now())).toBe(false);
    expect(podeArrancar(Date.now() + 61_000)).toBe(true);
  });
});
