import {
  avaliarVolume,
  caixaEnvolventeSTL,
} from '../src/utils/fatiador/volume';

/** STL binário mínimo: um cubo de aresta `lado`, centrado na origem. */
const cuboSTL = (lado: number): Uint8Array => {
  const meio = lado / 2;
  // 12 floats: normal (3) + três vértices (9). O atributo de 2 bytes fica a zero.
  const face = (v: number[][]): number[] => [
    0,
    0,
    0,
    ...v[0],
    ...v[1],
    ...v[2],
  ];
  const c = [
    [-meio, -meio, -meio],
    [meio, -meio, -meio],
    [meio, meio, -meio],
    [-meio, meio, -meio],
    [-meio, -meio, meio],
    [meio, -meio, meio],
    [meio, meio, meio],
    [-meio, meio, meio],
  ];
  const faces = [
    [c[0], c[2], c[1]],
    [c[0], c[3], c[2]],
    [c[4], c[5], c[6]],
    [c[4], c[6], c[7]],
    [c[0], c[1], c[5]],
    [c[0], c[5], c[4]],
    [c[3], c[6], c[2]],
    [c[3], c[7], c[6]],
    [c[0], c[4], c[7]],
    [c[0], c[7], c[3]],
    [c[1], c[2], c[6]],
    [c[1], c[6], c[5]],
  ];

  const buf = new ArrayBuffer(84 + faces.length * 50);
  const vista = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const nome = 'cubo';
  for (let i = 0; i < nome.length; i += 1) bytes[i] = nome.charCodeAt(i);
  vista.setUint32(80, faces.length, true);

  faces.forEach((tri, i) => {
    const inicio = 84 + i * 50;
    const valores = face(tri);
    for (let k = 0; k < valores.length; k += 1) {
      vista.setFloat32(inicio + k * 4, valores[k], true);
    }
  });
  return bytes;
};

describe('caixaEnvolventeSTL', () => {
  it('mede o cubo sem confundir a normal com um vértice', () => {
    const r = caixaEnvolventeSTL(cuboSTL(20));
    expect(r).not.toBeNull();
    expect(r!.triangulos).toBe(12);
    expect(r!.dimensoes.x).toBeCloseTo(20, 3);
    expect(r!.dimensoes.y).toBeCloseTo(20, 3);
    expect(r!.dimensoes.z).toBeCloseTo(20, 3);
  });

  it('recusa ficheiros que não são STL binário válido', () => {
    expect(caixaEnvolventeSTL(new Uint8Array(10))).toBeNull();
    expect(caixaEnvolventeSTL(new Uint8Array(84))).toBeNull();
  });

  it('não deixa passar dimensões erradas quando a normal é lida como vértice', () => {
    // Um leitor que comece em base 0 devolve 21 num cubo de 20 — a regressão
    // que o spike de viabilidade teve e que aqui fica travada.
    const r = caixaEnvolventeSTL(cuboSTL(20));
    expect(r!.dimensoes.z).not.toBeCloseTo(21, 3);
  });
});

describe('avaliarVolume', () => {
  const volume = { x: 256, y: 256, z: 256 };

  it('deixa fatiar quando cabe', () => {
    expect(avaliarVolume({ x: 20, y: 20, z: 10 }, volume)).toEqual({
      estado: 'cabe',
      bloqueia: false,
    });
  });

  it('bloqueia quando excede o volume útil na v1', () => {
    expect(avaliarVolume({ x: 300, y: 20, z: 10 }, volume).bloqueia).toBe(true);
    expect(avaliarVolume({ x: 300, y: 20, z: 10 }, volume).estado).toBe(
      'excede'
    );
  });

  it('avisa mas deixa avançar quando o perfil não traz volume', () => {
    expect(avaliarVolume({ x: 20, y: 20, z: 10 }, null)).toEqual({
      estado: 'volumeIndisponivel',
      bloqueia: false,
    });
  });

  it('bloqueia quando as dimensões do STL são desconhecidas', () => {
    expect(avaliarVolume(null, volume)).toEqual({
      estado: 'dimensoesDesconhecidas',
      bloqueia: true,
    });
    expect(avaliarVolume({ x: 0, y: 20, z: 10 }, volume).bloqueia).toBe(true);
  });
});
