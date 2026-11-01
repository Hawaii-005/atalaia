import {
  CAPACIDADES,
  CONTROLOS,
  Controlo,
  EstadoImpressora,
  LIMITE_ESTADO_ANTIGO_MS,
  Ligacao,
  ModeloImpressora,
  controlosDisponiveis,
  estaActivo,
} from '../src/utils/controlos/capacidades';

const MODELOS: ModeloImpressora[] = ['fdm', 'resina'];
const ESTADOS: EstadoImpressora[] = [
  'ociosa',
  'a-preparar',
  'a-imprimir',
  'em-pausa',
  'a-parar',
  'erro',
  'sem-ligacao',
  'estado-antigo',
];
const LIGACOES: Ligacao[] = [
  { ligada: true, idadeEstadoMs: 0 },
  { ligada: true, idadeEstadoMs: LIMITE_ESTADO_ANTIGO_MS },
  { ligada: true, idadeEstadoMs: LIMITE_ESTADO_ANTIGO_MS + 1 },
  { ligada: true, idadeEstadoMs: null },
  { ligada: false, idadeEstadoMs: 0 },
];

describe('controlosDisponiveis', () => {
  it('devolve sempre os seis controlos, sem buracos', () => {
    for (const modelo of MODELOS) {
      for (const estado of ESTADOS) {
        for (const ligacao of LIGACOES) {
          const mapa = controlosDisponiveis(modelo, estado, ligacao);
          expect(Object.keys(mapa).sort()).toEqual([...CONTROLOS].sort());
          for (const controlo of CONTROLOS) {
            expect(['activo', 'activo-com-aviso', 'desactivado']).toContain(
              mapa[controlo].estado
            );
          }
        }
      }
    }
  });

  it('sem ligação desativa tudo, seja qual for o modelo e o estado', () => {
    for (const modelo of MODELOS) {
      for (const estado of ESTADOS) {
        const mapa = controlosDisponiveis(modelo, estado, {
          ligada: false,
          idadeEstadoMs: 0,
        });
        for (const controlo of CONTROLOS) {
          expect(mapa[controlo]).toEqual({
            estado: 'desactivado',
            motivo: 'sem-ligacao',
          });
        }
      }
    }
  });

  it('estado antigo ou inexistente desativa tudo', () => {
    for (const idade of [LIMITE_ESTADO_ANTIGO_MS + 1, null]) {
      const mapa = controlosDisponiveis('fdm', 'ociosa', {
        ligada: true,
        idadeEstadoMs: idade,
      });
      for (const controlo of CONTROLOS) {
        expect(mapa[controlo]).toEqual({
          estado: 'desactivado',
          motivo: 'estado-antigo',
        });
      }
    }
  });

  it('aceita o limite exato de 45 s como estado fresco', () => {
    const mapa = controlosDisponiveis('fdm', 'ociosa', {
      ligada: true,
      idadeEstadoMs: LIMITE_ESTADO_ANTIGO_MS,
    });
    expect(mapa.movimento).toEqual({ estado: 'activo' });
  });

  it('na resina nada está ativo: não há comandos verificados', () => {
    expect(CAPACIDADES.resina).toHaveLength(0);
    for (const estado of ESTADOS) {
      const mapa = controlosDisponiveis('resina', estado, {
        ligada: true,
        idadeEstadoMs: 0,
      });
      for (const controlo of CONTROLOS) {
        expect(mapa[controlo]).toEqual({
          estado: 'desactivado',
          motivo: 'nao-verificado',
        });
      }
    }
  });

  it('na FDM ociosa tudo está ativo', () => {
    const mapa = controlosDisponiveis('fdm', 'ociosa', {
      ligada: true,
      idadeEstadoMs: 0,
    });
    for (const controlo of CONTROLOS) {
      expect(mapa[controlo]).toEqual({ estado: 'activo' });
    }
  });

  it('o movimento e o Home só ficam ativos na FDM ociosa', () => {
    for (const estado of ESTADOS) {
      if (estado === 'ociosa') continue;
      const mapa = controlosDisponiveis('fdm', estado, {
        ligada: true,
        idadeEstadoMs: 0,
      });
      for (const controlo of ['movimento', 'home'] as Controlo[]) {
        expect(estaActivo(mapa[controlo])).toBe(false);
      }
    }
  });

  it('a imprimir: luz e ventoinhas ativas, velocidade com aviso, resto bloqueado', () => {
    const mapa = controlosDisponiveis('fdm', 'a-imprimir', {
      ligada: true,
      idadeEstadoMs: 0,
    });
    expect(mapa.luz).toEqual({ estado: 'activo' });
    expect(mapa.ventoinhas).toEqual({ estado: 'activo' });
    expect(mapa.velocidade).toEqual({
      estado: 'activo-com-aviso',
      motivo: 'velocidade-durante-impressao',
    });
    expect(mapa.movimento).toEqual({
      estado: 'desactivado',
      motivo: 'a-imprimir',
    });
    expect(mapa.home).toEqual({ estado: 'desactivado', motivo: 'a-imprimir' });
    expect(mapa.temperatura).toEqual({
      estado: 'desactivado',
      motivo: 'a-imprimir',
    });
  });

  it('em pausa o movimento continua bloqueado, com motivo próprio', () => {
    const mapa = controlosDisponiveis('fdm', 'em-pausa', {
      ligada: true,
      idadeEstadoMs: 0,
    });
    expect(mapa.movimento).toEqual({
      estado: 'desactivado',
      motivo: 'em-pausa',
    });
    expect(mapa.luz).toEqual({ estado: 'activo' });
    expect(mapa.velocidade.estado).toBe('activo-com-aviso');
  });

  it('a preparar bloqueia movimento, Home e temperatura', () => {
    const mapa = controlosDisponiveis('fdm', 'a-preparar', {
      ligada: true,
      idadeEstadoMs: 0,
    });
    expect(mapa.movimento.estado).toBe('desactivado');
    expect(mapa.home.estado).toBe('desactivado');
    expect(mapa.temperatura.estado).toBe('desactivado');
    expect(mapa.luz.estado).toBe('activo');
    expect(mapa.velocidade.estado).toBe('activo');
  });

  it('num erro mantém luz e ventoinhas, bloqueia o resto', () => {
    const mapa = controlosDisponiveis('fdm', 'erro', {
      ligada: true,
      idadeEstadoMs: 0,
    });
    expect(mapa.luz.estado).toBe('activo');
    expect(mapa.ventoinhas.estado).toBe('activo');
    for (const controlo of ['movimento', 'home', 'velocidade', 'temperatura']) {
      expect(mapa[controlo as Controlo].estado).toBe('desactivado');
    }
  });

  it('cobre todas as combinações modelo × estado × ligação', () => {
    let casos = 0;
    for (const modelo of MODELOS) {
      for (const estado of ESTADOS) {
        for (const ligacao of LIGACOES) {
          controlosDisponiveis(modelo, estado, ligacao);
          casos += 1;
        }
      }
    }
    expect(casos).toBe(MODELOS.length * ESTADOS.length * LIGACOES.length);
  });
});
