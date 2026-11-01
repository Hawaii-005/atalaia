jest.mock('react-native', () => ({
  NativeModules: {},
  DeviceEventEmitter: { addListener: () => ({ remove: () => {} }) },
}));

import { nomeLimpo, tipoDoFicheiro } from '../src/utils/partilha';

describe('nomeLimpo', () => {
  it('tira o caminho e mantém o nome', () => {
    expect(nomeLimpo('/storage/emulated/0/Download/Benchy.gcode')).toBe(
      'Benchy.gcode'
    );
    expect(
      nomeLimpo('content://media/external/file/123/Caixa%20v2.gcode')
    ).toBe('Caixa_20v2.gcode');
  });

  it('troca o que não serve num nome de ficheiro', () => {
    expect(nomeLimpo('peça: nova*"x".gcode')).toBe('pe_a_ nova_x_.gcode');
    expect(nomeLimpo('linha\nquebrada.gcode')).toBe('linha_quebrada.gcode');
  });

  it('não deixa o nome vazio nem passar dos 120 caracteres', () => {
    expect(nomeLimpo('')).toBe('partilhado.gcode');
    expect(nomeLimpo('///')).toBe('partilhado.gcode');
    expect(nomeLimpo('a'.repeat(300))).toHaveLength(120);
  });
});

describe('tipoDoFicheiro', () => {
  it('reconhece G-code, com maiúsculas ou minúsculas', () => {
    expect(tipoDoFicheiro('Benchy.GCODE')).toBe('gcode');
    expect(tipoDoFicheiro('Benchy.gcode')).toBe('gcode');
    expect(tipoDoFicheiro('Benchy.goo')).toBe('gcode');
  });

  it('reconhece modelos que a app não fatia', () => {
    expect(tipoDoFicheiro('peça.stl')).toBe('modelo');
    expect(tipoDoFicheiro('peça.3MF')).toBe('modelo');
    expect(tipoDoFicheiro('peça.obj')).toBe('modelo');
  });

  it('recusa o resto', () => {
    expect(tipoDoFicheiro('foto.jpg')).toBe('outro');
    expect(tipoDoFicheiro('arquivo.zip')).toBe('outro');
    expect(tipoDoFicheiro('')).toBe('outro');
  });
});
