import {
  verificarCompatibilidadeSlot,
  verificarTodosOsSlots,
  FerramentaGcode,
} from '../src/utils/filamentos/verificacao';
import { Spool } from '../src/utils/filamentos/modelo';

const bobinaBase: Spool = {
  id: 'b1',
  nome: 'PLA Vermelho',
  marca: 'eSUN',
  material: 'PLA',
  cor: '#FF0000',
  pesoInicial: 1000,
  restante: 500,
  preco: 20,
  printerId: 'p1',
  criadoEm: 1000,
  canvasSlot: 0,
};

describe('verificarCompatibilidadeSlot', () => {
  it('avisa se não houver bobina associada ao slot', () => {
    const f: FerramentaGcode = { index: 0, material: 'PLA', pesoG: 50 };
    const avisos = verificarCompatibilidadeSlot(0, f, undefined);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe('SEM_BOBINA');
    expect(avisos[0].mensagem).toContain('Slot A1 não tem bobina');
  });

  it('avisa se o material for diferente', () => {
    const f: FerramentaGcode = { index: 0, material: 'PETG', pesoG: 50 };
    const avisos = verificarCompatibilidadeSlot(0, f, bobinaBase);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe('MATERIAL_DIFERENTE');
    expect(avisos[0].mensagem).toContain('PLA');
    expect(avisos[0].mensagem).toContain('PETG');
  });

  it('avisa se o peso restante for insuficiente', () => {
    const f: FerramentaGcode = { index: 0, material: 'PLA', pesoG: 800 };
    const avisos = verificarCompatibilidadeSlot(0, f, bobinaBase);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe('PESO_INSUFICIENTE');
    expect(avisos[0].mensagem).toContain('500 g');
    expect(avisos[0].mensagem).toContain('800 g');
  });

  it('não produz avisos quando tudo é compatível', () => {
    const f: FerramentaGcode = { index: 0, material: 'PLA', pesoG: 100 };
    const avisos = verificarCompatibilidadeSlot(0, f, bobinaBase);
    expect(avisos).toHaveLength(0);
  });
});

describe('verificarTodosOsSlots', () => {
  it('verifica múltiplos slots', () => {
    const f0: FerramentaGcode = { index: 0, material: 'PLA', pesoG: 100 };
    const f1: FerramentaGcode = { index: 1, material: 'ABS', pesoG: 200 };
    const avisos = verificarTodosOsSlots([f0, f1], [bobinaBase]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].slot).toBe(1);
    expect(avisos[0].tipo).toBe('SEM_BOBINA');
  });
});
