import {
  aplicarFiltros,
  contarFavoritos,
  descreverResumo,
  filtrarFicheiros,
  normalizarTexto,
  nomeCurto,
  ordenarFicheiros,
  tamanhoDoFicheiro,
} from '../src/utils/ficheiros/lista';
import { duracaoDoNome } from '../src/utils/duracao';

const ficheiros = [
  { name: '/local/peça-do-polvo.gcode', FileSize: 2000, CreateTime: 3 },
  { name: '/local/Peça-Pequena.gcode', FileSize: 1000, CreateTime: 1 },
  { name: '/local/suporte_1h12m.gcode', FileSize: 3000, CreateTime: 2 },
  { name: '/local/caixa 2h.gcode', FileSize: 500, CreateTime: 4 },
];

describe('normalizarTexto', () => {
  it('tira acentos e maiúsculas', () => {
    expect(normalizarTexto('  PEÇA ')).toBe('peca');
    expect(normalizarTexto('Suporte_ção')).toBe('suporte_cao');
  });

  it('nomeCurto devolve só o ficheiro', () => {
    expect(nomeCurto('/local/a/b.gcode')).toBe('b.gcode');
    expect(nomeCurto('sem-barras.gcode')).toBe('sem-barras.gcode');
  });
});

describe('pesquisa', () => {
  const base = { ordem: 'nome' as const, crescente: true };

  it('encontra com acentos diferentes dos do ficheiro', () => {
    const resultado = filtrarFicheiros(ficheiros, { ...base, texto: 'peca' });
    expect(resultado.map(f => f.name)).toEqual([
      '/local/peça-do-polvo.gcode',
      '/local/Peça-Pequena.gcode',
    ]);
  });

  it('encontra pelo meio do nome', () => {
    expect(
      filtrarFicheiros(ficheiros, { ...base, texto: 'polvo' })
    ).toHaveLength(1);
  });

  it('ignora os espaços à volta', () => {
    expect(
      filtrarFicheiros(ficheiros, { ...base, texto: '  caixa ' })
    ).toHaveLength(1);
  });

  it('devolve tudo com a pesquisa vazia', () => {
    expect(filtrarFicheiros(ficheiros, { ...base, texto: '   ' })).toHaveLength(
      4
    );
  });
});

describe('favoritos', () => {
  const base = { ordem: 'nome' as const, crescente: true };
  const favorito = (nome: string) => nome.includes('polvo');

  it('filtra só os favoritos', () => {
    const resultado = filtrarFicheiros(
      ficheiros,
      { ...base, texto: '', apenasFavoritos: true },
      favorito
    );
    expect(resultado.map(f => f.name)).toEqual(['/local/peça-do-polvo.gcode']);
  });

  it('sem a marcação não devolve nada', () => {
    expect(
      filtrarFicheiros(ficheiros, { ...base, texto: '', apenasFavoritos: true })
    ).toHaveLength(0);
  });

  it('conta os favoritos de uma lista', () => {
    expect(contarFavoritos(ficheiros, favorito)).toBe(1);
  });
});

describe('ordenação', () => {
  it('por nome, crescente e decrescente', () => {
    const nomes = ordenarFicheiros(ficheiros, 'nome', true).map(f =>
      nomeCurto(f.name)
    );
    expect(nomes[0]).toBe('caixa 2h.gcode');
    expect(
      ordenarFicheiros(ficheiros, 'nome', false)
        .map(f => nomeCurto(f.name))
        .pop()
    ).toBe('caixa 2h.gcode');
  });

  it('por tamanho', () => {
    expect(
      ordenarFicheiros(ficheiros, 'tamanho', true).map(tamanhoDoFicheiro)
    ).toEqual([500, 1000, 2000, 3000]);
  });

  it('por data', () => {
    expect(
      ordenarFicheiros(ficheiros, 'data', true).map(f => f.CreateTime)
    ).toEqual([1, 2, 3, 4]);
  });

  it('por duração lida do nome', () => {
    const duracao = ordenarFicheiros(ficheiros, 'duracao', true).map(f =>
      nomeCurto(f.name)
    );
    // Quem tem duração vem primeiro; quem não tem fica no fim.
    expect(duracao).toEqual([
      'suporte_1h12m.gcode',
      'caixa 2h.gcode',
      'peça-do-polvo.gcode',
      'Peça-Pequena.gcode',
    ]);
  });

  it('sem duração fica no fim nas duas direcções', () => {
    const crescente = ordenarFicheiros(ficheiros, 'duracao', true);
    const decrescente = ordenarFicheiros(ficheiros, 'duracao', false);
    const semDuracao = (nome: string) => duracaoDoNome(nome) === 0;

    // As duas sem duração são as últimas, cresça ou decresça.
    expect(semDuracao(crescente[0].name)).toBe(false);
    expect(semDuracao(crescente[1].name)).toBe(false);
    expect(semDuracao(crescente[2].name)).toBe(true);
    expect(semDuracao(crescente[3].name)).toBe(true);
    expect(semDuracao(decrescente[0].name)).toBe(false);
    expect(semDuracao(decrescente[3].name)).toBe(true);

    // E as que têm duração aparecem por ordem.
    expect(nomeCurto(decrescente[0].name)).toBe('caixa 2h.gcode');
    expect(nomeCurto(decrescente[1].name)).toBe('suporte_1h12m.gcode');
  });

  it('não altera a lista original', () => {
    const copia = [...ficheiros];
    ordenarFicheiros(ficheiros, 'nome', true);
    expect(ficheiros).toEqual(copia);
  });
});

describe('aplicarFiltros', () => {
  it('junta pesquisa e ordem', () => {
    const resultado = aplicarFiltros(
      ficheiros,
      { texto: 'peca', ordem: 'tamanho', crescente: false },
      () => false
    );
    expect(resultado.map(tamanhoDoFicheiro)).toEqual([2000, 1000]);
  });

  it('o filtro de favoritos também se aplica com pesquisa', () => {
    const resultado = aplicarFiltros(
      ficheiros,
      { texto: 'peca', ordem: 'nome', crescente: true, apenasFavoritos: true },
      nome => nome.includes('Pequena')
    );
    expect(resultado.map(f => f.name)).toEqual(['/local/Peça-Pequena.gcode']);
  });
});

describe('descreverResumo', () => {
  it('soma os tamanhos visíveis e diz se há filtro', () => {
    const resumo = descreverResumo(ficheiros.slice(0, 2), 4, 'nome');
    expect(resumo).toEqual({
      ficheiros: 2,
      bytes: 3000,
      filtrado: true,
      ordem: 'nome',
    });
  });

  it('sem filtro o total coincide', () => {
    expect(descreverResumo(ficheiros, 4, 'data').filtrado).toBe(false);
  });
});

describe('tamanhoDoFicheiro', () => {
  it('prefere FileSize e cai para totalSize/usedSize', () => {
    expect(tamanhoDoFicheiro({ name: 'a', FileSize: 10, totalSize: 99 })).toBe(
      10
    );
    expect(tamanhoDoFicheiro({ name: 'a', totalSize: 99 })).toBe(99);
    expect(tamanhoDoFicheiro({ name: 'a', usedSize: 7 })).toBe(7);
    expect(tamanhoDoFicheiro({ name: 'a' })).toBe(0);
  });
});
