import {
  TOLERANCIA_TEMPO_SEG,
  compararMetadados,
  tempoEmSegundos,
} from '../src/envio/verificacao';

describe('tempo do cabeçalho em segundos', () => {
  const casos: [string, number][] = [
    ['12m 2s', 722],
    ['1h 48m', 6480],
    ['8m 43s', 523],
    ['1h 0m 5s', 3605],
  ];
  test.each(casos)('%s → %i', (texto: string, segundos: number) => {
    expect(tempoEmSegundos(texto)).toBe(segundos);
  });

  test('sem tempo legível devolve null', () => {
    expect(tempoEmSegundos('')).toBeNull();
    expect(tempoEmSegundos(null)).toBeNull();
    expect(tempoEmSegundos('desconhecido')).toBeNull();
  });
});

describe('comparação com os metadados do Moonraker', () => {
  const local = { bytes: 270859, camadas: 128, tempoSeg: 722 };

  test('tudo igual', () => {
    expect(
      compararMetadados(local, {
        tamanho: 270859,
        camadas: 128,
        tempoSeg: 722,
      })
    ).toBe('igual');
  });

  test('tamanho exacto: um byte a mais já é diferente', () => {
    expect(
      compararMetadados(local, {
        tamanho: 270860,
        camadas: 128,
        tempoSeg: 722,
      })
    ).toBe('diferente');
  });

  test('camadas diferentes são diferentes', () => {
    expect(
      compararMetadados(local, {
        tamanho: 270859,
        camadas: 127,
        tempoSeg: 722,
      })
    ).toBe('diferente');
  });

  test('o tempo admite a tolerância e recusa acima dela', () => {
    const dentro = local.tempoSeg + TOLERANCIA_TEMPO_SEG;
    const fora = local.tempoSeg + TOLERANCIA_TEMPO_SEG + 1;
    expect(
      compararMetadados(local, {
        tamanho: 270859,
        camadas: 128,
        tempoSeg: dentro,
      })
    ).toBe('igual');
    expect(
      compararMetadados(local, {
        tamanho: 270859,
        camadas: 128,
        tempoSeg: fora,
      })
    ).toBe('diferente');
  });

  test('metadados ainda incompletos ficam indeterminados, não verificados', () => {
    expect(
      compararMetadados(local, { tamanho: null, camadas: 128, tempoSeg: 722 })
    ).toBe('indeterminado');
    expect(
      compararMetadados(local, {
        tamanho: 270859,
        camadas: 128,
        tempoSeg: null,
      })
    ).toBe('indeterminado');
  });

  test('sem tempo no slicer, o tempo não decide', () => {
    expect(
      compararMetadados(
        { ...local, tempoSeg: null },
        { tamanho: 270859, camadas: 128, tempoSeg: null }
      )
    ).toBe('igual');
  });
});
