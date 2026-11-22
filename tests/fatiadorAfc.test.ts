jest.mock('../src/utils/httpLocal', () => ({
  ...jest.requireActual('../src/utils/httpLocal'),
  pedirJsonLocal: jest.fn(),
}));

import {
  lerPistas,
  avisosAfc,
  bloqueioEnvio,
  nivelAviso,
  pistaDoTool,
  Pista,
  LIMITE_PLA,
} from '../src/utils/fatiador/afc';
import {
  hostPrivado,
  destinoPermitido,
  pedirJsonLocal,
} from '../src/utils/httpLocal';

const pista = (
  nome: string,
  material: string,
  mapa: string[],
  extra: Partial<Pista> = {}
): Pista => ({
  nome,
  material,
  mapa,
  bico: null,
  mesa: null,
  carregada: true,
  ...extra,
});

const g = (material: string, bico: number, mesa: number) => ({
  material,
  bico,
  mesa,
});

describe('pista que serve a ferramenta', () => {
  const pistas = [
    pista('AFC_lane CANVAS_1', 'PLA', ['T0']),
    pista('AFC_lane CANVAS_2', 'PETG', ['T1']),
    pista('AFC_lane CANVAS_3', 'ABS', []),
  ];

  it('escolhe pelo map, não pelo nome', () => {
    expect(pistaDoTool(pistas, 1)?.material).toBe('PETG');
    expect(pistaDoTool(pistas, 0)?.material).toBe('PLA');
  });

  it('pista sem map não serve nenhuma ferramenta', () => {
    expect(pistaDoTool(pistas, 3)).toBeNull();
  });

  it('sem TOOL no G-code não se adivinha', () => {
    expect(pistaDoTool(pistas, null)).toBeNull();
  });

  it('AFC mudo e AFC sem pista mapeada são avisos distintos', () => {
    // (a) não respondeu: não se sabe o que está na pista.
    expect(avisosAfc(null, g('PLA', 210, 60), undefined, false)).toEqual([
      'afcMudo',
    ]);
    // (b) respondeu, mas nenhuma pista serve o T{TOOL}.
    expect(avisosAfc(null, g('PLA', 210, 60), undefined, true)).toEqual([
      'pistaNaoMapeada',
    ]);
  });
});

describe('discordâncias G-code × pista', () => {
  it('PLA na pista com bico a 260 °C', () => {
    expect(avisosAfc(pista('x', 'PLA', ['T0']), g('PLA', 260, 60))).toEqual([
      'plaLimite',
    ]);
  });

  it('material diferente entre G-code e pista', () => {
    expect(avisosAfc(pista('x', 'PETG', ['T0']), g('PLA', 230, 70))).toEqual([
      'materialDiferente',
    ]);
  });

  it('PETG na pista a 210 °C: bico abaixo do intervalo', () => {
    expect(avisosAfc(pista('x', 'PETG', ['T0']), g('PETG', 210, 75))).toEqual([
      'bicoBaixo',
    ]);
  });

  it('ABS na pista com mesa a 60 °C', () => {
    expect(avisosAfc(pista('x', 'ABS', ['T0']), g('ABS', 250, 60))).toEqual([
      'mesaBaixa',
    ]);
  });

  it('PLA-CF na pista é PLA para efeitos de material', () => {
    expect(avisosAfc(pista('x', 'PLA-CF', ['T0']), g('PLA', 220, 60))).toEqual(
      []
    );
  });

  it('exatamente no limite não avisa', () => {
    expect(
      avisosAfc(pista('x', 'PLA', ['T0']), g('PLA', LIMITE_PLA, 60))
    ).toEqual([]);
  });
});

describe('mesa depende da chapa', () => {
  it('PLA a 35 °C é válido na Cool Plate', () => {
    expect(
      avisosAfc(pista('x', 'PLA', ['T0']), g('PLA', 210, 35), 'Cool Plate')
    ).toEqual([]);
  });

  it('PLA a 35 °C na Textured PEI é aviso de mesa', () => {
    expect(
      avisosAfc(
        pista('x', 'PLA', ['T0']),
        g('PLA', 210, 35),
        'Textured PEI Plate'
      )
    ).toEqual(['mesaBaixa']);
  });

  it('PLA-CF a 260 °C não dispara o limite de PLA puro', () => {
    expect(
      avisosAfc(pista('x', 'PLA-CF', ['T0']), g('PLA-CF', 260, 60))
    ).toEqual([]);
  });
});

describe('regra do E5', () => {
  it('sem avisos o envio passa', () => {
    expect(bloqueioEnvio([])).toEqual({
      nivel: 'nenhum',
      bloqueado: false,
      podeIgnorar: false,
      requerConfirmacao: false,
    });
  });

  it('crítico bloqueia mas pode ser ignorado', () => {
    expect(bloqueioEnvio(['plaLimite'])).toEqual({
      nivel: 'critico',
      bloqueado: true,
      podeIgnorar: true,
      requerConfirmacao: false,
    });
  });

  it('aviso de temperatura só pede confirmação', () => {
    expect(bloqueioEnvio(['mesaBaixa'])).toEqual({
      nivel: 'aviso',
      bloqueado: false,
      podeIgnorar: false,
      requerConfirmacao: true,
    });
  });

  it('AFC mudo não bloqueia: pede confirmação e deixa seguir', () => {
    expect(bloqueioEnvio(['afcMudo'])).toEqual({
      nivel: 'aviso',
      bloqueado: false,
      podeIgnorar: false,
      requerConfirmacao: true,
    });
  });

  it('AFC sem pista mapeada também só pede confirmação', () => {
    expect(bloqueioEnvio(['pistaNaoMapeada'])).toEqual({
      nivel: 'aviso',
      bloqueado: false,
      podeIgnorar: false,
      requerConfirmacao: true,
    });
  });

  it('crítico e aviso juntos ficam críticos', () => {
    expect(nivelAviso('materialDiferente')).toBe('critico');
    expect(bloqueioEnvio(['plaLimite', 'mesaBaixa']).nivel).toBe('critico');
  });
});

describe('HTTP em claro só em rede privada', () => {
  it('aceita LAN e loopback', () => {
    [
      '192.168.1.6',
      '192.168.1.6:7125',
      '10.0.0.2',
      '172.20.1.1',
      '100.91.189.97',
      '127.0.0.1',
      'tv.local',
    ].forEach(h => expect(hostPrivado(h)).toBe(true));
  });

  it('recusa endereços públicos e nomes estranhos', () => {
    [
      '8.8.8.8',
      '172.32.0.1',
      '100.128.0.1',
      '200.1.2.3',
      'example.com',
    ].forEach(h => expect(hostPrivado(h)).toBe(false));
  });
});

describe('lerPistas: recusa de redirect não é AFC mudo', () => {
  const pedir = pedirJsonLocal as jest.Mock;

  test('redirect para fora da rede propaga o código (o ecrã mostra aviso próprio)', async () => {
    pedir.mockRejectedValueOnce(new Error('redirect_fora_da_rede'));
    await expect(lerPistas('192.168.1.195:8099')).rejects.toThrow(
      'redirect_fora_da_rede'
    );
  });

  test('avaria de rede devolve null (AFC mudo)', async () => {
    pedir.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(lerPistas('192.168.1.195:8099')).resolves.toBeNull();
  });

  test('o aviso de recusa não bloqueia, mas pede confirmação', () => {
    expect(nivelAviso('afcRecusado')).toBe('aviso');
    expect(bloqueioEnvio(['afcRecusado'])).toEqual({
      nivel: 'aviso',
      bloqueado: false,
      podeIgnorar: false,
      requerConfirmacao: true,
    });
  });
});
