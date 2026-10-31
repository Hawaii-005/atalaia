import {
  anguloHora,
  pontoHora,
  arcoSvg,
  ordenarPorFim,
  proximoAFim,
  TrabalhoRelogio,
} from '../src/utils/relogio';

describe('anguloHora', () => {
  it('0 h → -π/2 (topo)', () => {
    expect(anguloHora(0)).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('6 h → 0 (direita)', () => {
    expect(anguloHora(6)).toBeCloseTo(0, 5);
  });

  it('12 h → π/2 (fundo)', () => {
    expect(anguloHora(12)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('18 h → π (esquerda)', () => {
    expect(anguloHora(18)).toBeCloseTo(Math.PI, 5);
  });

  it('24 h é igual a 0 h', () => {
    expect(anguloHora(24)).toBeCloseTo(anguloHora(0), 5);
  });

  it('valores negativos são normalizados', () => {
    expect(anguloHora(-6)).toBeCloseTo(anguloHora(18), 5);
    expect(anguloHora(-12)).toBeCloseTo(anguloHora(12), 5);
  });

  it('valores acima de 24 são normalizados', () => {
    expect(anguloHora(30)).toBeCloseTo(anguloHora(6), 5);
    expect(anguloHora(48)).toBeCloseTo(anguloHora(0), 5);
  });
});

describe('pontoHora', () => {
  it('0 h no centro [100, 100] com raio 100 → [100, 0]', () => {
    const [x, y] = pontoHora(0, 100, 100, 100);
    expect(x).toBeCloseTo(100, 1);
    expect(y).toBeCloseTo(0, 1);
  });

  it('6 h no centro [100, 100] com raio 100 → [200, 100]', () => {
    const [x, y] = pontoHora(6, 100, 100, 100);
    expect(x).toBeCloseTo(200, 1);
    expect(y).toBeCloseTo(100, 1);
  });

  it('12 h no centro [100, 100] com raio 100 → [100, 200]', () => {
    const [x, y] = pontoHora(12, 100, 100, 100);
    expect(x).toBeCloseTo(100, 1);
    expect(y).toBeCloseTo(200, 1);
  });

  it('18 h no centro [100, 100] com raio 100 → [0, 100]', () => {
    const [x, y] = pontoHora(18, 100, 100, 100);
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(100, 1);
  });
});

describe('arcoSvg', () => {
  it('horas iguais devolvem string vazia', () => {
    expect(arcoSvg(6, 6, 100, 100, 100)).toBe('');
    expect(arcoSvg(0, 0, 100, 100, 100)).toBe('');
    expect(arcoSvg(12, 12, 100, 100, 100)).toBe('');
  });

  it('arco curto (< 12 h) usa large-arc-flag = 0', () => {
    const path = arcoSvg(0, 6, 100, 100, 100);
    expect(path).toContain(' 0 0 1 ');
  });

  it('arco longo (> 12 h) usa large-arc-flag = 1', () => {
    const path = arcoSvg(0, 18, 100, 100, 100);
    expect(path).toContain(' 0 1 1 ');
  });

  it('path tem formato M x y A r r 0 flag 1 x y', () => {
    const path = arcoSvg(0, 3, 50, 100, 100);
    expect(path).toMatch(
      /^M \d+\.\d{3} \d+\.\d{3} A \d+\.\d{3} \d+\.\d{3} 0 [01] 1 \d+\.\d{3} \d+\.\d{3}$/
    );
  });

  it('coordenadas têm 3 casas decimais', () => {
    const path = arcoSvg(0, 6, 100, 100, 100);
    const numeros = path.match(/\d+\.\d+/g) || [];
    numeros.forEach(n => {
      const decimais = n.split('.')[1];
      expect(decimais?.length).toBe(3);
    });
  });

  it('normaliza horas fora de 0..24', () => {
    const path1 = arcoSvg(0, 6, 100, 100, 100);
    const path2 = arcoSvg(24, 30, 100, 100, 100);
    expect(path1).toBe(path2);
  });
});

describe('ordenarPorFim', () => {
  const trabalhos: TrabalhoRelogio[] = [
    { id: '1', nome: 'A', inicio: 8, fim: 12, cor: '#aaa' },
    { id: '2', nome: 'B', inicio: 10, fim: 14, cor: '#bbb' },
    { id: '3', nome: 'C', inicio: 6, fim: 9, cor: '#ccc' },
  ];

  it('ordena por fim crescente', () => {
    const ordenados = ordenarPorFim(trabalhos);
    expect(ordenados[0].fim).toBe(9);
    expect(ordenados[1].fim).toBe(12);
    expect(ordenados[2].fim).toBe(14);
  });

  it('não muta o array original', () => {
    const original = [...trabalhos];
    ordenarPorFim(trabalhos);
    expect(trabalhos).toEqual(original);
  });

  it('array vazio devolve array vazio', () => {
    expect(ordenarPorFim([])).toEqual([]);
  });
});

describe('proximoAFim', () => {
  const trabalhos: TrabalhoRelogio[] = [
    { id: '1', nome: 'A', inicio: 8, fim: 12, cor: '#aaa' },
    { id: '2', nome: 'B', inicio: 10, fim: 14, cor: '#bbb' },
    { id: '3', nome: 'C', inicio: 6, fim: 9, cor: '#ccc' },
  ];

  it('devolve o trabalho que acaba primeiro entre os não acabados', () => {
    const proximo = proximoAFim(trabalhos, 7);
    expect(proximo?.id).toBe('3');
    expect(proximo?.fim).toBe(9);
  });

  it('ignora trabalhos já acabados', () => {
    const proximo = proximoAFim(trabalhos, 9);
    expect(proximo?.id).toBe('1');
    expect(proximo?.fim).toBe(12);
  });

  it('devolve null quando todos acabaram', () => {
    expect(proximoAFim(trabalhos, 14)).toBeNull();
    expect(proximoAFim(trabalhos, 20)).toBeNull();
  });

  it('considera acabado quando agora === fim', () => {
    const proximo = proximoAFim(trabalhos, 12);
    expect(proximo?.id).toBe('2');
    expect(proximo?.fim).toBe(14);
  });

  it('array vazio devolve null', () => {
    expect(proximoAFim([], 10)).toBeNull();
  });
});
