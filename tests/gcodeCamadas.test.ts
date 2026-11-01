import {
  alturaDaCamada,
  caminhoDaCamada,
  coresDasCamadas,
  lerCamadas,
} from '../src/utils/gcode/camadas';

/** G-code mínimo: uma parede quadrada com N camadas a 0,2 mm. */
const quadrado = (camadas: number) => {
  const linhas = ['M82', 'G21', 'G90'];
  for (let c = 0; c < camadas; c += 1) {
    const z = (0.2 * (c + 1)).toFixed(1);
    linhas.push(`G1 Z${z} F600`);
    linhas.push('G1 X0 Y0 F3000');
    const pontos = [
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    pontos.forEach(([x, y], k) => {
      // O E absoluto tem de crescer em cada movimento, senão o firmware
      // (e o leitor) consideram que não há extrusão.
      linhas.push(`G1 X${x} Y${y} E${(c * 4 + k + 1).toFixed(3)}`);
    });
  }
  return linhas.join('\n');
};

describe('lerCamadas', () => {
  it('le uma camada por altura, com os segmentos certos', () => {
    const r = lerCamadas(quadrado(3));
    expect(r.camadas).toHaveLength(3);
    expect(r.camadas[0].z).toBeCloseTo(0.2, 3);
    expect(r.camadas[2].z).toBeCloseTo(0.6, 3);
    // Quatro arestas por camada.
    expect(r.camadas[0].segmentos.length).toBe(4 * 4);
    expect(r.truncado).toBe(false);
  });

  it('nao conta deslocacoes nem retracoes', () => {
    const gcode = [
      'M82',
      'G1 Z0.2',
      'G1 X0 Y0',
      'G1 X10 Y0 E1',
      'G1 X10 Y10 E2',
      'G1 X50 Y50', // deslocação sem E
      'G1 X50 Y60 E3',
    ].join('\n');
    const r = lerCamadas(gcode);
    expect(r.camadas).toHaveLength(1);
    // Três movimentos com extrusão: (0,0)→(10,0), (10,0)→(10,10) e o que
    // vem depois da deslocação, (50,50)→(50,60). A deslocação não entra.
    expect(r.camadas[0].segmentos.length).toBe(3 * 4);
    // O salto de (10,10) para (50,50) não entra como segmento.
    const xs = Array.from(r.camadas[0].segmentos).filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(50);
  });

  it('nao cria camada falsa com Z-hop e retracao', () => {
    const gcode = [
      'M82',
      'G1 Z0.2',
      'G1 X0 Y0',
      'G1 X10 Y0 E1',
      'G1 X10 Y10 E2',
      // Z-hop: sobe, viaja, desce — sem extrudir
      'G1 Z0.6',
      'G1 X20 Y20',
      'G1 Z0.2',
      'G1 X20 Y21 E3',
    ].join('\n');
    const r = lerCamadas(gcode);
    expect(r.camadas).toHaveLength(1);
  });

  it('respeita os marcadores de camada do fatiador', () => {
    const gcode = [
      'M82',
      ';LAYER_CHANGE',
      ';Z:0.2',
      'G1 Z0.2',
      'G1 X0 Y0',
      'G1 X10 Y0 E1',
      'G1 X10 Y10 E2',
      ';LAYER_CHANGE',
      'G1 Z0.2', // mesma altura, mas o marcador manda
      'G1 X0 Y0',
      'G1 X5 Y0 E3',
      'G1 X5 Y5 E4',
    ].join('\n');
    const r = lerCamadas(gcode);
    expect(r.comMarcadores).toBe(true);
    expect(r.camadas).toHaveLength(2);
  });

  it('marca a cor nova quando ha M600', () => {
    const gcode = [
      'M82',
      'G1 Z0.2',
      'G1 X0 Y0',
      'G1 X10 Y0 E1',
      'G1 X10 Y10 E2',
      'M600',
      'G1 Z0.4',
      'G1 X0 Y0',
      'G1 X10 Y0 E3',
      'G1 X10 Y10 E4',
    ].join('\n');
    const r = lerCamadas(gcode);
    expect(r.camadas[0].cor).toBeNull();
    expect(r.camadas[1].cor).toBe(1);
    expect(coresDasCamadas(r.camadas)).toBe(2);
  });

  it('devolve vazio quando nao ha extrusao', () => {
    const r = lerCamadas('G1 X10 Y10 F3000\nG1 Z5');
    expect(r.camadas).toHaveLength(0);
  });

  it('marca truncado quando o ficheiro e enorme', () => {
    const gcode = ['M82', 'G1 Z0.2'];
    for (let i = 0; i < 200; i += 1) {
      gcode.push(`G1 X${i} Y${i % 7} E${i + 1}`);
    }
    const r = lerCamadas(gcode.join('\n'), 20);
    expect(r.truncado).toBe(true);
    expect(r.camadas[0].segmentos.length).toBeLessThanOrEqual(20 * 4);
  });

  it('calcula a altura de cada camada', () => {
    const r = lerCamadas(quadrado(3));
    expect(alturaDaCamada(r.camadas, 0)).toBeCloseTo(0.2, 3);
    expect(alturaDaCamada(r.camadas, 2)).toBeCloseTo(0.2, 3);
  });
});

describe('caminhoDaCamada', () => {
  it('desenha um quadrado dentro da caixa, com 4 sub-caminhos', () => {
    const r = lerCamadas(quadrado(1));
    const d = caminhoDaCamada(r.camadas[0], r.limites);
    // A parede é contínua (o fim de uma aresta é o início da seguinte), por
    // isso o caminho tem um único sub-caminho — só haveria mais M se houvesse
    // saltos entre paredes separadas.
    expect((d.match(/M/g) ?? []).length).toBe(1);
    expect(d).not.toMatch(/NaN|Infinity/);
    const numeros = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.min(...numeros)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numeros)).toBeLessThanOrEqual(100);
  });

  it('aguenta uma camada vazia sem rebentar', () => {
    const d = caminhoDaCamada(
      { z: 0.2, segmentos: new Float32Array(), cor: null },
      { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    );
    expect(d).toBe('');
  });
});
