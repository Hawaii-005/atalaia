/**
 * Capacidades e bloqueios dos controlos — lógica pura, sem React nem rede.
 *
 * Regra de ouro: um controlo só fica ativo quando existe comando verificado
 * para aquele modelo E o estado da máquina o permite. Na dúvida, desativa-se
 * com motivo visível — nunca se envia um comando às cegas.
 */

export type ModeloImpressora = 'fdm' | 'resina';

/** Estados que a app consegue distinguir a partir do SDCP. */
export type EstadoImpressora =
  | 'ociosa'
  | 'a-preparar'
  | 'a-imprimir'
  | 'em-pausa'
  | 'a-parar'
  | 'erro'
  | 'sem-ligacao'
  | 'estado-antigo';

export type Controlo =
  | 'movimento'
  | 'home'
  | 'luz'
  | 'ventoinhas'
  | 'velocidade'
  | 'temperatura';

export type MotivoBloqueio =
  | 'sem-ligacao'
  | 'estado-antigo'
  | 'a-preparar'
  | 'a-imprimir'
  | 'em-pausa'
  | 'a-parar'
  | 'erro'
  | 'nao-verificado';

export type MotivoAviso = 'velocidade-durante-impressao';

export type Disponibilidade =
  | { estado: 'activo' }
  | { estado: 'activo-com-aviso'; motivo: MotivoAviso }
  | { estado: 'desactivado'; motivo: MotivoBloqueio };

export type Ligacao = {
  /** `connectionStatus === 'connected'` no contexto das impressoras. */
  ligada: boolean;
  /** Idade do último estado recebido; `null` = nunca chegou estado. */
  idadeEstadoMs: number | null;
};

export type MapaControlos = Record<Controlo, Disponibilidade>;

/** Acima disto, o estado é considerado antigo e nada é enviado. */
export const LIMITE_ESTADO_ANTIGO_MS = 45_000;

export const CONTROLOS: Controlo[] = [
  'movimento',
  'home',
  'luz',
  'ventoinhas',
  'velocidade',
  'temperatura',
];

/**
 * Capacidades verificadas no código para cada modelo.
 *
 * FDM: todos os comandos existem e são usados hoje (`Cmd 401`, `402`, `403`).
 * Resina: o transporte SDCP é o mesmo, mas nenhum destes comandos foi
 * verificado na Saturn 3 Ultra — por isso fica tudo «não verificado».
 * Quando houver confirmação no aparelho, basta acrescentar aqui.
 */
export const CAPACIDADES: Record<ModeloImpressora, Controlo[]> = {
  fdm: ['movimento', 'home', 'luz', 'ventoinhas', 'velocidade', 'temperatura'],
  resina: [],
};

const ATIVO: Disponibilidade = { estado: 'activo' };
const bloqueado = (motivo: MotivoBloqueio): Disponibilidade => ({
  estado: 'desactivado',
  motivo,
});

/** Regras por estado, para um modelo que suporte o controlo. */
const REGRAS: Record<EstadoImpressora, Record<Controlo, Disponibilidade>> = {
  ociosa: {
    movimento: ATIVO,
    home: ATIVO,
    luz: ATIVO,
    ventoinhas: ATIVO,
    velocidade: ATIVO,
    temperatura: ATIVO,
  },
  'a-preparar': {
    movimento: bloqueado('a-preparar'),
    home: bloqueado('a-preparar'),
    luz: ATIVO,
    ventoinhas: ATIVO,
    velocidade: ATIVO,
    temperatura: bloqueado('a-preparar'),
  },
  'a-imprimir': {
    movimento: bloqueado('a-imprimir'),
    home: bloqueado('a-imprimir'),
    luz: ATIVO,
    ventoinhas: ATIVO,
    velocidade: {
      estado: 'activo-com-aviso',
      motivo: 'velocidade-durante-impressao',
    },
    temperatura: bloqueado('a-imprimir'),
  },
  'em-pausa': {
    movimento: bloqueado('em-pausa'),
    home: bloqueado('em-pausa'),
    luz: ATIVO,
    ventoinhas: ATIVO,
    velocidade: {
      estado: 'activo-com-aviso',
      motivo: 'velocidade-durante-impressao',
    },
    temperatura: bloqueado('em-pausa'),
  },
  'a-parar': {
    movimento: bloqueado('a-parar'),
    home: bloqueado('a-parar'),
    luz: ATIVO,
    ventoinhas: ATIVO,
    velocidade: bloqueado('a-parar'),
    temperatura: bloqueado('a-parar'),
  },
  erro: {
    movimento: bloqueado('erro'),
    home: bloqueado('erro'),
    luz: ATIVO,
    ventoinhas: ATIVO,
    velocidade: bloqueado('erro'),
    temperatura: bloqueado('erro'),
  },
  'sem-ligacao': {
    movimento: bloqueado('sem-ligacao'),
    home: bloqueado('sem-ligacao'),
    luz: bloqueado('sem-ligacao'),
    ventoinhas: bloqueado('sem-ligacao'),
    velocidade: bloqueado('sem-ligacao'),
    temperatura: bloqueado('sem-ligacao'),
  },
  'estado-antigo': {
    movimento: bloqueado('estado-antigo'),
    home: bloqueado('estado-antigo'),
    luz: bloqueado('estado-antigo'),
    ventoinhas: bloqueado('estado-antigo'),
    velocidade: bloqueado('estado-antigo'),
    temperatura: bloqueado('estado-antigo'),
  },
};

/**
 * O que cada controlo pode fazer agora.
 *
 * Ordem das verificações: ligação → idade do estado → capacidade do modelo →
 * estado da máquina. A primeira que falha manda, para o motivo ser sempre o
 * mais concreto para o utilizador.
 */
export const controlosDisponiveis = (
  modelo: ModeloImpressora,
  estado: EstadoImpressora,
  ligacao: Ligacao
): MapaControlos => {
  const suportados = CAPACIDADES[modelo];

  return CONTROLOS.reduce((mapa, controlo) => {
    if (!ligacao.ligada) {
      mapa[controlo] = bloqueado('sem-ligacao');
    } else if (
      ligacao.idadeEstadoMs === null ||
      ligacao.idadeEstadoMs > LIMITE_ESTADO_ANTIGO_MS
    ) {
      mapa[controlo] = bloqueado('estado-antigo');
    } else if (!suportados.includes(controlo)) {
      mapa[controlo] = bloqueado('nao-verificado');
    } else if (estado === 'sem-ligacao') {
      mapa[controlo] = bloqueado('sem-ligacao');
    } else if (estado === 'estado-antigo') {
      mapa[controlo] = bloqueado('estado-antigo');
    } else {
      mapa[controlo] = REGRAS[estado][controlo];
    }
    return mapa;
  }, {} as MapaControlos);
};

export const estaActivo = (d: Disponibilidade): boolean =>
  d.estado === 'activo' || d.estado === 'activo-com-aviso';
