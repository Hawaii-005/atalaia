import {
  caminhoRemoto,
  carimbo,
  nomeComCarimbo,
  validarNome,
} from '../src/envio/nomeRemoto';

const AGORA = new Date('2026-11-22T06:10:08Z');

describe('nome remoto com carimbo', () => {
  test('o carimbo é UTC e estável', () => {
    expect(carimbo(AGORA)).toBe('20261122-061008');
  });

  test('limpa espaços e a extensão do ficheiro de origem', () => {
    expect(nomeComCarimbo('cubo 25.6.stl', AGORA)).toBe(
      'cubo-25.6-20261122-061008.gcode'
    );
    expect(nomeComCarimbo('cubo25_6.gcode', AGORA)).toBe(
      'cubo25_6-20261122-061008.gcode'
    );
  });

  test('base vazia ou só símbolos não ganha nome vazio', () => {
    expect(nomeComCarimbo('  ***  ', AGORA)).toBe(
      'modelo-20261122-061008.gcode'
    );
  });

  test('base comprida é truncada mas o nome continua válido', () => {
    const nome = nomeComCarimbo('a'.repeat(300), AGORA);
    expect(nome.length).toBeLessThanOrEqual(120);
    expect(validarNome(nome)).toBe(true);
  });
});

describe('validação do caminho remoto', () => {
  test('aceita nomes simples', () => {
    expect(validarNome('cubo-20261122-061008.gcode')).toBe(true);
  });

  const invalidos = [
    ['../etc/passwd.gcode'],
    ['gcodes/../../x.gcode'],
    ['sub/x.gcode'],
    ['x.gcode/'],
    ['x.txt'],
    ['.oculto.gcode'],
    [''],
  ];
  test.each(invalidos)('recusa %s', (nome: string) => {
    expect(validarNome(nome)).toBe(false);
  });

  test('o caminho fica sempre dentro de gcodes/', () => {
    expect(caminhoRemoto('a.gcode')).toBe('gcodes/a.gcode');
    expect(() => caminhoRemoto('../a.gcode')).toThrow('nome_invalido');
    expect(() => caminhoRemoto('gcodes/../a.gcode')).toThrow('nome_invalido');
  });
});
