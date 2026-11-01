import { valorDoToque } from '../src/utils/controlos/deslizante';

describe('valorDoToque', () => {
  it('mapeia a largura para 0–100', () => {
    expect(valorDoToque(0, 200)).toBe(0);
    expect(valorDoToque(100, 200)).toBe(50);
    expect(valorDoToque(200, 200)).toBe(100);
  });

  it('arredonda ao passo de 5%', () => {
    expect(valorDoToque(51, 200)).toBe(25);
    expect(valorDoToque(55, 200)).toBe(30);
  });

  it('nunca sai do intervalo, mesmo com toques fora do trilho', () => {
    expect(valorDoToque(-40, 200)).toBe(0);
    expect(valorDoToque(400, 200)).toBe(100);
  });

  it('largura inválida devolve 0 em vez de NaN', () => {
    expect(valorDoToque(10, 0)).toBe(0);
    expect(valorDoToque(Number.NaN, 200)).toBe(0);
  });
});
