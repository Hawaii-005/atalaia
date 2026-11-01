import { PrintInfo } from '../src/types';
import {
  estadoDoTrabalho,
  formatarCamadas,
  formatarGramas,
  formatarPercentagem,
  formatarRestante,
  formatarTemperatura,
  limitarPercentagem,
  nomeDoFicheiro,
  restanteEmSegundos,
} from '../src/utils/inicio/formatadores';

const info = (parcial: Partial<PrintInfo>): PrintInfo =>
  ({
    Status: 6,
    CurrentLayer: 12,
    TotalLayer: 120,
    CurrentTicks: 3600,
    TotalTicks: 7920,
    Filename: '/local//peca.gcode',
    TaskId: 't1',
    PrintSpeedPct: 100,
    Progress: 42,
    ...parcial,
  }) as PrintInfo;

describe('percentagem', () => {
  it('arredonda e leva o símbolo', () => {
    expect(formatarPercentagem(42.4)).toBe('42%');
    expect(formatarPercentagem(42.6)).toBe('43%');
  });

  it('nunca sai de 0..100', () => {
    expect(limitarPercentagem(-30)).toBe(0);
    expect(limitarPercentagem(140)).toBe(100);
    expect(formatarPercentagem(140)).toBe('100%');
  });

  it('NaN e infinito contam como zero', () => {
    expect(limitarPercentagem(Number.NaN)).toBe(0);
    expect(limitarPercentagem(Number.POSITIVE_INFINITY)).toBe(0);
    expect(formatarPercentagem(Number.NaN)).toBe('0%');
  });
});

describe('tempo restante', () => {
  it('sai de TotalTicks menos CurrentTicks', () => {
    expect(restanteEmSegundos(info({}))).toBe(4320);
    expect(formatarRestante(restanteEmSegundos(info({})))).toBe('1h12m');
  });

  it('nunca é negativo, mesmo quando a máquina passa do total', () => {
    expect(
      restanteEmSegundos(info({ CurrentTicks: 9000, TotalTicks: 7920 }))
    ).toBe(0);
  });

  it('sem tempo nenhum devolve null, para não escrever «0m»', () => {
    expect(formatarRestante(0)).toBeNull();
    expect(formatarRestante(-5)).toBeNull();
    expect(
      formatarRestante(restanteEmSegundos(info({ TotalTicks: 0 })))
    ).toBeNull();
  });

  it('menos de uma hora mostra só minutos', () => {
    expect(formatarRestante(45 * 60)).toBe('45m');
  });

  it('sem informação de impressão não rebenta', () => {
    expect(restanteEmSegundos(null)).toBe(0);
    expect(restanteEmSegundos(undefined)).toBe(0);
  });
});

describe('temperaturas', () => {
  it('mostra valor e alvo quando o alvo existe', () => {
    expect(formatarTemperatura(210.4, 210)).toEqual({
      valor: '210°',
      alvo: '/ 210°',
    });
  });

  it('sem alvo (0 ou ausente) não inventa segunda linha', () => {
    expect(formatarTemperatura(31, 0).alvo).toBeNull();
    expect(formatarTemperatura(31).alvo).toBeNull();
    expect(formatarTemperatura(31, null).alvo).toBeNull();
  });

  it('sem valor mostra travessão em vez de zero', () => {
    expect(formatarTemperatura(undefined, 60)).toEqual({
      valor: '—°',
      alvo: '/ 60°',
    });
    expect(formatarTemperatura(null, null).valor).toBe('—°');
  });
});

describe('gramas', () => {
  it('arredonda e leva a unidade', () => {
    expect(formatarGramas(302.4)).toBe('302 g');
    expect(formatarGramas(0)).toBe('0 g');
  });

  it('sem valor, negativo ou inválido mostra travessão', () => {
    expect(formatarGramas(undefined)).toBe('—');
    expect(formatarGramas(null)).toBe('—');
    expect(formatarGramas(-1)).toBe('—');
    expect(formatarGramas(Number.NaN)).toBe('—');
  });
});

describe('camadas', () => {
  it('mostra actual e total', () => {
    expect(formatarCamadas(12, 120)).toBe('12 / 120');
  });

  it('sem total não mostra nada (a máquina ainda não sabe)', () => {
    expect(formatarCamadas(0, 0)).toBeNull();
    expect(formatarCamadas(12, undefined)).toBeNull();
  });
});

describe('estado do trabalho', () => {
  it('sem ligação ganha a tudo o resto', () => {
    expect(
      estadoDoTrabalho({ ligada: false, printInfo: info({ Status: 6 }) })
    ).toBe('semLigacao');
  });

  it('ligada e sem ficheiro está pronta', () => {
    expect(
      estadoDoTrabalho({
        ligada: true,
        printInfo: info({ Filename: '', Status: 0 }),
      })
    ).toBe('pronta');
  });

  it('a imprimir', () => {
    expect(
      estadoDoTrabalho({ ligada: true, printInfo: info({ Status: 6 }) })
    ).toBe('imprimindo');
  });

  it('a pausa é o mesmo código com os ticks parados', () => {
    expect(
      estadoDoTrabalho({
        ligada: true,
        printInfo: info({ Status: 20, Filename: '/x.gcode' }),
        ticksParados: true,
      })
    ).toBe('pausada');
  });

  it('status 20 com ticks a andar ainda é preparação', () => {
    expect(
      estadoDoTrabalho({
        ligada: true,
        printInfo: info({ Status: 20 }),
        ticksParados: false,
      })
    ).toBe('preparando');
  });

  it('terminada e parada', () => {
    expect(
      estadoDoTrabalho({ ligada: true, printInfo: info({ Status: 9 }) })
    ).toBe('terminada');
    expect(
      estadoDoTrabalho({ ligada: true, printInfo: info({ Status: 7 }) })
    ).toBe('parada');
  });

  it('erro da máquina ganha ao código de estado', () => {
    expect(
      estadoDoTrabalho({
        ligada: true,
        printInfo: info({ Status: 6, ErrorNumber: 4 }),
      })
    ).toBe('erro');
  });

  it('sem PrintInfo mas ligada está pronta', () => {
    expect(estadoDoTrabalho({ ligada: true, printInfo: null })).toBe('pronta');
  });
});

describe('nome do ficheiro', () => {
  it('tira o caminho, a extensão e o sufixo do fatiador', () => {
    expect(nomeDoFicheiro('/local//suporte_Elegoo PLA_0.2_1h20m.gcode')).toBe(
      'suporte'
    );
    expect(nomeDoFicheiro('peca.gcode')).toBe('peca');
  });

  it('sem nome devolve vazio', () => {
    expect(nomeDoFicheiro(undefined)).toBe('');
    expect(nomeDoFicheiro('')).toBe('');
  });
});
