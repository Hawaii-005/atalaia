import {
  EntradaDefinicao,
  ORDEM_SECOES,
  entradasDaSecao,
  filtrarEntradas,
  idsVisiveis,
  normalizar,
  secoesVisiveis,
  termosDaConsulta,
} from '../src/utils/definicoes/pesquisa';

const ENTRADAS: EntradaDefinicao[] = [
  {
    id: 'impressoras.adicionar',
    secao: 'impressoras',
    titulo: 'Adicionar impressora',
    ajuda: 'Procura impressoras na rede local',
    palavras: ['nova', 'lan'],
  },
  {
    id: 'aparencia.tema',
    secao: 'aparencia',
    titulo: 'Tema',
    ajuda: 'Muda as cores da aplicação',
    palavras: ['cores', 'escuro'],
  },
  {
    id: 'fila.auto',
    secao: 'fila',
    titulo: 'Arrancar o próximo automaticamente',
    ajuda: 'Quando um trabalho acaba começa o próximo da fila',
    palavras: ['fila', 'automático'],
  },
  {
    id: 'filamentos.limite',
    secao: 'filamentos',
    titulo: 'Aviso de bobina quase no fim',
    ajuda: 'Percentagem que dispara o aviso',
    palavras: ['rolo', 'restante'],
  },
  {
    id: 'dados.backup',
    secao: 'dados',
    titulo: 'Cópia de segurança',
    ajuda: 'Exporta impressoras e definições',
    palavras: ['backup', 'json'],
  },
];

describe('normalizar', () => {
  it('tira acentos e passa a minúsculas', () => {
    expect(normalizar('Definições')).toBe('definicoes');
    expect(normalizar('  Cópia de Segurança ')).toBe('copia de seguranca');
  });
});

describe('termosDaConsulta', () => {
  it('divide por espaços e ignora vazios', () => {
    expect(termosDaConsulta('  ')).toEqual([]);
    expect(termosDaConsulta(' tema  escuro ')).toEqual(['tema', 'escuro']);
  });
});

describe('filtrarEntradas', () => {
  it('devolve tudo quando a consulta está vazia', () => {
    expect(filtrarEntradas(ENTRADAS, '')).toHaveLength(ENTRADAS.length);
    expect(filtrarEntradas(ENTRADAS, '   ')).toHaveLength(ENTRADAS.length);
  });

  it('encontra pelo título sem acentos', () => {
    const ids = filtrarEntradas(ENTRADAS, 'copia seguranca').map(e => e.id);
    expect(ids).toEqual(['dados.backup']);
  });

  it('encontra pela ajuda', () => {
    const ids = filtrarEntradas(ENTRADAS, 'cores').map(e => e.id);
    expect(ids).toEqual(['aparencia.tema']);
  });

  it('encontra pelas palavras-chave', () => {
    const ids = filtrarEntradas(ENTRADAS, 'backup').map(e => e.id);
    expect(ids).toEqual(['dados.backup']);
    expect(filtrarEntradas(ENTRADAS, 'rolo').map(e => e.id)).toEqual([
      'filamentos.limite',
    ]);
  });

  it('exige todos os termos', () => {
    expect(filtrarEntradas(ENTRADAS, 'tema escuro').map(e => e.id)).toEqual([
      'aparencia.tema',
    ]);
    expect(filtrarEntradas(ENTRADAS, 'tema fila')).toHaveLength(0);
  });

  it('não encontra o que não existe', () => {
    expect(filtrarEntradas(ENTRADAS, 'xilofone')).toHaveLength(0);
  });
});

describe('idsVisiveis e secoesVisiveis', () => {
  it('com consulta vazia, todas as secções com opções aparecem por ordem', () => {
    expect(secoesVisiveis(ENTRADAS, '')).toEqual([
      'impressoras',
      'aparencia',
      'fila',
      'filamentos',
      'dados',
    ]);
    expect(ORDEM_SECOES).toContain('sobre');
  });

  it('esconde as secções sem resultados e mantém a ordem', () => {
    expect(secoesVisiveis(ENTRADAS, 'tema')).toEqual(['aparencia']);
    expect(secoesVisiveis(ENTRADAS, 'backup')).toEqual(['dados']);
    expect(secoesVisiveis(ENTRADAS, 'xilofone')).toEqual([]);
  });

  it('idsVisiveis devolve os ids filtrados', () => {
    const ids = idsVisiveis(ENTRADAS, 'fila');
    expect(ids.has('fila.auto')).toBe(true);
    expect(ids.has('dados.backup')).toBe(false);
  });
});

describe('entradasDaSecao', () => {
  it('filtra por secção', () => {
    expect(entradasDaSecao(ENTRADAS, 'aparencia').map(e => e.id)).toEqual([
      'aparencia.tema',
    ]);
    expect(entradasDaSecao(ENTRADAS, 'sobre')).toHaveLength(0);
  });
});
