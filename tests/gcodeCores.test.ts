import {
  consumoDoGcode,
  eMulticolor,
  filamentosDoCabecalho,
  materialDoCabecalho,
  normalizarCor,
} from '../src/utils/gcodeCores';

describe('normalizarCor', () => {
  it('completa as cores de três dígitos', () => {
    expect(normalizarCor('#ABC')).toBe('#aabbcc');
    expect(normalizarCor('f80')).toBe('#ff8800');
  });

  it('aceita seis dígitos com ou sem cardinal', () => {
    expect(normalizarCor('36A8E1')).toBe('#36a8e1');
    expect(normalizarCor(' #AF7832 ')).toBe('#af7832');
  });

  it('recusa o resto', () => {
    expect(normalizarCor(undefined)).toBeUndefined();
    expect(normalizarCor('')).toBeUndefined();
    expect(normalizarCor('azul')).toBeUndefined();
    expect(normalizarCor('#12345')).toBeUndefined();
  });
});

describe('filamentosDoCabecalho', () => {
  // É este o caso do ficheiro "mask": o fatiador declara 4 slots, mas só usa um.
  const umaCor = `; thumbnail begin 144x144 20
; AAA
; thumbnail end
; filament_colour = #000000,#AF7832,#FFFFFF,#FFFFFF
; filament used [g] = 125.96, 0.00, 0.00, 0.00
; filament_type = PLA,PLA,PLA,PLA`;

  it('só conta as ferramentas com consumo', () => {
    const lista = filamentosDoCabecalho(umaCor);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toEqual({
      tool: 0,
      cor: '#000000',
      gramas: 125.96,
      tipo: 'PLA',
    });
    expect(eMulticolor(lista)).toBe(false);
  });

  it('lê várias ferramentas e marca multicolor', () => {
    const duas = `; filament_colour = #E0A458,#077747
; filament used [g] = 10.5, 2.25
; filament_type = PLA,PETG`;
    const lista = filamentosDoCabecalho(duas);
    expect(lista.map(f => f.tool)).toEqual([0, 1]);
    expect(lista[1].gramas).toBe(2.25);
    expect(lista[1].tipo).toBe('PETG');
    expect(eMulticolor(lista)).toBe(true);
  });

  it('fica com a última ocorrência do cabeçalho', () => {
    const repetido = `; filament used [g] = 1, 1
; filament used [g] = 7.5, 0.00`;
    const lista = filamentosDoCabecalho(repetido);
    expect(lista).toHaveLength(1);
    expect(lista[0].gramas).toBe(7.5);
  });

  it('não rebenta com texto vazio', () => {
    expect(filamentosDoCabecalho('')).toEqual([]);
  });
});

describe('materialDoCabecalho e consumoDoGcode', () => {
  it('reconhece o material declarado', () => {
    expect(materialDoCabecalho('; filament_type = PETG,PLA')).toBe('PETG');
    expect(materialDoCabecalho('sem cabeçalho')).toBe('PLA');
  });

  it('soma o consumo com uma casa decimal', () => {
    // 1 m de PLA a 1,75 mm: 2,405 cm3 × 1,24 g/cm3 ≈ 2,98 g
    const texto = `M83
G1 X10 Y10 E1000`;
    const consumo = consumoDoGcode(texto);
    expect(consumo.metros).toBeCloseTo(1, 2);
    expect(consumo.gramas).toBeCloseTo(2.98, 1);
    expect(consumo.material).toBe('PLA');
  });
});
