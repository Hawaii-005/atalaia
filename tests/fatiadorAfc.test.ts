import {
  avisosAfc,
  bloqueioEnvio,
  hostPrivado,
  pistaDoTool,
  Pista,
  LIMITE_PLA,
} from '../src/utils/fatiador/afc';

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

  it('AFC sem resposta dá pistaDesconhecida', () => {
    expect(avisosAfc(null, g('PLA', 210, 60))).toEqual(['pistaDesconhecida']);
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

describe('regra do E5', () => {
  it('sem avisos o envio passa', () => {
    expect(bloqueioEnvio([])).toEqual({
      bloqueado: false,
      requerConfirmacao: false,
    });
  });

  it('aviso real bloqueia mas pode ser ignorado', () => {
    expect(bloqueioEnvio(['plaLimite'])).toEqual({
      bloqueado: true,
      requerConfirmacao: false,
    });
  });

  it('AFC sem resposta exige confirmação', () => {
    expect(bloqueioEnvio(['pistaDesconhecida'])).toEqual({
      bloqueado: true,
      requerConfirmacao: true,
    });
  });
});

describe('HTTP em claro só em rede privada', () => {
  it('aceita LAN e loopback', () => {
    [
      '192.168.1.6',
      '192.168.1.6:7125',
      '10.0.0.2',
      '172.20.1.1',
      '127.0.0.1',
      'tv.local',
    ].forEach(h => expect(hostPrivado(h)).toBe(true));
  });

  it('recusa endereços públicos e nomes estranhos', () => {
    ['8.8.8.8', '172.32.0.1', '200.1.2.3', 'example.com'].forEach(h =>
      expect(hostPrivado(h)).toBe(false)
    );
  });
});
