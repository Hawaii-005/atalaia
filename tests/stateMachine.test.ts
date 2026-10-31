import { calcularEstadoLogico } from '../src/protocol/stateMachine';

describe('Máquina de Estados Pura', () => {
  it('identifica estado idle / repouso', () => {
    expect(calcularEstadoLogico({ statusCode: 0 })).toBe('idle');
    expect(calcularEstadoLogico({ statusCode: 7 })).toBe('idle');
    expect(
      calcularEstadoLogico({ statusCode: 0, currentStatus: 0, isResin: true })
    ).toBe('idle');
  });

  it('identifica aquecimento quando há alvo definido', () => {
    expect(
      calcularEstadoLogico({
        statusCode: 1,
        tempNozzle: 25,
        tempTargetNozzle: 210,
      })
    ).toBe('heating');
  });

  it('identifica preparação quando temperaturas estão próximas', () => {
    expect(
      calcularEstadoLogico({
        statusCode: 1,
        tempNozzle: 210,
        tempTargetNozzle: 210,
      })
    ).toBe('preparing');
  });

  it('identifica nivelamento', () => {
    expect(calcularEstadoLogico({ statusCode: 3 })).toBe('leveling');
  });

  it('identifica impressão e pausa', () => {
    expect(calcularEstadoLogico({ statusCode: 5 })).toBe('printing');
    expect(calcularEstadoLogico({ statusCode: 8 })).toBe('paused');
    expect(calcularEstadoLogico({ statusCode: 20 })).toBe('paused');
  });

  it('identifica conclusão e paragem', () => {
    expect(calcularEstadoLogico({ statusCode: 9 })).toBe('completed');
    expect(calcularEstadoLogico({ statusCode: 16 })).toBe('completed');
    expect(calcularEstadoLogico({ statusCode: 10 })).toBe('stopping');
    expect(calcularEstadoLogico({ statusCode: 14 })).toBe('stopping');
  });

  it('identifica erro', () => {
    expect(calcularEstadoLogico({ statusCode: 99 })).toBe('error');
    expect(calcularEstadoLogico({ statusCode: 255 })).toBe('error');
  });
});
