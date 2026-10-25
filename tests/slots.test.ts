import { rotuloSlot, slotValido } from '../src/utils/slots';

describe('slotValido', () => {
  it('aceita os quatro slots reais', () => {
    expect(slotValido(0, 3)).toBe(0);
    expect(slotValido(2, 0)).toBe(2);
    expect(slotValido('3', 1)).toBe(3);
  });

  it('nunca deixa passar o 255 do fatiador', () => {
    expect(slotValido(255, 0)).toBe(0);
    expect(slotValido(255, 5)).toBe(1);
  });

  it('cai no índice da cor quando o valor é inválido', () => {
    expect(slotValido(undefined, 2)).toBe(2);
    expect(slotValido(null, 6)).toBe(2);
    expect(slotValido(-1, 3)).toBe(3);
    expect(slotValido(9, 4)).toBe(0);
    expect(slotValido('abc', 7)).toBe(3);
  });
});

describe('rotuloSlot', () => {
  it('mostra A1 no slot zero, como a impressora', () => {
    expect(rotuloSlot(0)).toBe('A1');
    expect(rotuloSlot(3)).toBe('A4');
  });
});
