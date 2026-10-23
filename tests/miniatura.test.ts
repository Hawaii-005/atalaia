// Testes da extração de miniaturas. O caso real usa o .ctb da Saturn 3 Ultra
// (CTB v5 cifrado, magic 0x12FD0107) copiado do telemóvel para /tmp; se não
// existir, esses testes são saltados.

import * as fs from 'fs';

jest.mock('expo-file-system', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

import {
  codificarPng,
  deBase64,
  descodificarRgb15,
  encontrarPrevisao,
  paraBase64,
} from '../src/saturn/miniatura';

const REAL = '/tmp/modelo.ctb';

describe('base64', () => {
  it('ida e volta preserva os bytes', () => {
    const dados = new Uint8Array([0, 1, 2, 250, 251, 255, 0, 77, 128, 129]);
    expect(Array.from(deBase64(paraBase64(dados)))).toEqual(Array.from(dados));
  });

  it('comprime e expande todos os restos', () => {
    for (let n = 0; n < 6; n++) {
      const dados = new Uint8Array(n).fill(7);
      expect(deBase64(paraBase64(dados)).length).toBe(n);
    }
  });
});

describe('estrutura da pré-visualização (CTB v5)', () => {
  it('ignora cabeçalhos sem estrutura válida', () => {
    const lixo = new Uint8Array(4096).fill(0xff);
    expect(encontrarPrevisao(lixo, 4096)).toBeNull();
  });

  it('encontra a estrutura no ficheiro real', () => {
    if (!fs.existsSync(REAL)) return;
    const tamanho = fs.statSync(REAL).size;
    const cabecalho = new Uint8Array(fs.readFileSync(REAL).subarray(0, 262144));
    const p = encontrarPrevisao(cabecalho, tamanho);
    expect(p).not.toBeNull();
    expect(p!.largura).toBe(320);
    expect(p!.altura).toBe(500);
    expect(p!.tamanho).toBe(98034);
    expect(p!.offset + p!.tamanho).toBeLessThanOrEqual(tamanho);
  });
});

describe('RGB15 com RLE', () => {
  it('preenche a imagem toda a partir do ficheiro real', () => {
    if (!fs.existsSync(REAL)) return;
    const ficheiro = fs.readFileSync(REAL);
    const p = encontrarPrevisao(
      new Uint8Array(ficheiro.subarray(0, 262144)),
      ficheiro.length
    )!;
    const dados = new Uint8Array(ficheiro.subarray(p.offset, p.offset + p.tamanho));
    const rgb = descodificarRgb15(dados, p.largura, p.altura);
    expect(rgb).not.toBeNull();
    expect(rgb!.length).toBe(320 * 500 * 3);
    // a imagem não pode ser toda preta
    expect(rgb!.some(v => v > 0)).toBe(true);
  });

  it('recusa dados que não chegam para a imagem', () => {
    const dados = new Uint8Array([1, 2, 3, 4]);
    expect(descodificarRgb15(dados, 320, 500)).toBeNull();
  });
});

describe('PNG', () => {
  it('gera um PNG válido com assinatura, IHDR e IEND', () => {
    const rgb = new Uint8Array(4 * 3).fill(9);
    const png = codificarPng(rgb, 2, 2);
    expect(Array.from(png.subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const texto = Buffer.from(png).toString('latin1');
    expect(texto).toContain('IHDR');
    expect(texto).toContain('IDAT');
    expect(texto).toContain('IEND');
  });

  it('guarda o PNG da miniatura real para inspeção', () => {
    if (!fs.existsSync(REAL)) return;
    const ficheiro = fs.readFileSync(REAL);
    const p = encontrarPrevisao(
      new Uint8Array(ficheiro.subarray(0, 262144)),
      ficheiro.length
    )!;
    const dados = new Uint8Array(ficheiro.subarray(p.offset, p.offset + p.tamanho));
    const rgb = descodificarRgb15(dados, p.largura, p.altura)!;
    const png = codificarPng(rgb, p.largura, p.altura);
    fs.writeFileSync('/tmp/thumb_node.png', png);
    expect(png.length).toBeGreaterThan(1000);
  });
});
