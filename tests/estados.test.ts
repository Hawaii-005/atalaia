import { classificarEstado, isPausable, isResumable } from '../src/types';

const impressao = (status: number, filename = '/local//x.gcode') => ({
  Filename: filename,
  Status: status,
  CurrentLayer: 1,
  TotalLayer: 50,
  Progress: 10,
} as any);

describe('classificarEstado', () => {
  it('sem ficheiro e parada é idle', () => {
    expect(classificarEstado(impressao(0, ''), false)).toBe('idle');
  });

  it('sem ficheiro mas a parar ainda é stopped', () => {
    expect(classificarEstado(impressao(7, ''), false)).toBe('stopped');
    expect(classificarEstado(impressao(8, ''), false)).toBe('stopped');
  });

  it('status 20 sem ticks parados é preparação, não pausa', () => {
    expect(classificarEstado(impressao(20), false)).not.toBe('paused');
  });

  it('status 20 com ticks parados é pausa', () => {
    expect(classificarEstado(impressao(20), true)).toBe('paused');
  });

  it('status 9 (terminada) nunca é impressão em curso', () => {
    expect(classificarEstado(impressao(9), false)).toBe('completed');
  });
});

describe('botões de controlo', () => {
  it('pausa só em impressão e arranque de camada', () => {
    expect(isPausable(6)).toBe(true);
    expect(isPausable(13)).toBe(true);
    expect(isPausable(20)).toBe(false);
  });

  it('retomar aceita o estado de pausa 20', () => {
    expect(isResumable(20)).toBe(true);
  });
});
