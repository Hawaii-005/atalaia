import {
  alternarFavorito,
  chaveDe,
  definirEtiquetas,
  estadoVazio,
  favoritosDe,
  marcarFavorito,
  MAX_ETIQUETAS,
  podarRegistos,
  procurarRegisto,
  registarArranque,
  resumoDoRegisto,
} from '../src/utils/ficheiros/modelo';

const alvo = {
  printerId: 'p1',
  nome: '/local/peça.gcode',
  tamanho: 12_400_000,
};

describe('chaveDe', () => {
  it('é estável para o mesmo ficheiro, mesmo com maiúsculas e espaços', () => {
    expect(chaveDe(alvo)).toBe(
      chaveDe({ ...alvo, nome: ' /LOCAL/PEÇA.GCODE ', tamanho: 12_400_000 })
    );
  });

  it('distingue versões com o mesmo nome e tamanhos diferentes', () => {
    expect(chaveDe(alvo)).not.toBe(chaveDe({ ...alvo, tamanho: 12_500_000 }));
  });

  it('distingue o mesmo ficheiro em impressoras diferentes', () => {
    expect(chaveDe(alvo)).not.toBe(chaveDe({ ...alvo, printerId: 'p2' }));
  });
});

describe('procurarRegisto', () => {
  it('encontra um registo guardado sem tamanho quando o tamanho passa a ser conhecido', () => {
    const estado = marcarFavorito(
      estadoVazio(),
      { printerId: 'p1', nome: '/local/peça.gcode' },
      true
    );
    expect(procurarRegisto(estado, alvo)?.favorito).toBe(true);
    expect(estado.registos).toHaveLength(1);
  });

  it('não confunde dois tamanhos conhecidos e diferentes', () => {
    const estado = marcarFavorito(estadoVazio(), alvo, true);
    expect(
      procurarRegisto(estado, { ...alvo, tamanho: 999 })?.favorito
    ).toBeUndefined();
  });

  it('não mistura impressoras', () => {
    const estado = marcarFavorito(estadoVazio(), alvo, true);
    expect(
      procurarRegisto(estado, { ...alvo, printerId: 'p2' })
    ).toBeUndefined();
  });
});

describe('favorito', () => {
  it('marca e desmarca sem duplicar o registo', () => {
    const um = marcarFavorito(estadoVazio(), alvo, true);
    const dois = marcarFavorito(um, alvo, false);
    expect(dois.registos).toHaveLength(1);
    expect(dois.registos[0].favorito).toBe(false);
  });

  it('alternar cria o registo já favorito', () => {
    const estado = alternarFavorito(estadoVazio(), alvo);
    expect(estado.registos[0].favorito).toBe(true);
    expect(alternarFavorito(estado, alvo).registos[0].favorito).toBe(false);
  });

  it('não altera o estado que recebe', () => {
    const antes = estadoVazio();
    marcarFavorito(antes, alvo, true);
    expect(antes.registos).toHaveLength(0);
  });

  it('lista os favoritos da impressora', () => {
    let estado = marcarFavorito(estadoVazio(), alvo, true);
    estado = marcarFavorito(estado, { ...alvo, printerId: 'p2' }, true);
    expect(favoritosDe(estado, 'p1')).toEqual(['/local/peça.gcode']);
  });
});

describe('registarArranque', () => {
  it('conta a primeira impressão', () => {
    const estado = registarArranque(estadoVazio(), alvo, {
      jobId: 'start-1',
      quando: '2026-11-01T09:00:00.000Z',
    });
    expect(estado.registos[0].reimpressoes).toBe(1);
    expect(estado.registos[0].ultimaImpressao).toBe('2026-11-01T09:00:00.000Z');
  });

  it('não conta duas vezes o mesmo job', () => {
    const um = registarArranque(estadoVazio(), alvo, { jobId: 'start-1' });
    const dois = registarArranque(um, alvo, { jobId: 'start-1' });
    expect(dois.registos[0].reimpressoes).toBe(1);
    expect(dois).toBe(um);
  });

  it('conta um job novo', () => {
    const um = registarArranque(estadoVazio(), alvo, { jobId: 'start-1' });
    const dois = registarArranque(um, alvo, { jobId: 'start-2' });
    expect(dois.registos[0].reimpressoes).toBe(2);
  });

  it('sobrevive a um registo guardado com o mesmo job (app reaberta)', () => {
    const guardado = JSON.parse(
      JSON.stringify(
        registarArranque(estadoVazio(), alvo, { jobId: 'start-1' })
      )
    );
    const depois = registarArranque(guardado, alvo, { jobId: 'start-1' });
    expect(depois.registos[0].reimpressoes).toBe(1);
  });

  it('sem jobId não conta nada', () => {
    const estado = registarArranque(estadoVazio(), alvo, { jobId: '  ' });
    expect(estado.registos).toHaveLength(0);
  });
});

describe('etiquetas', () => {
  it('limpa espaços, ignora repetidas e vazias', () => {
    const estado = definirEtiquetas(estadoVazio(), alvo, [
      '  Cliente ',
      'cliente',
      '',
      'urgente',
    ]);
    expect(estado.registos[0].etiquetas).toEqual(['Cliente', 'urgente']);
  });

  it('limita o número de etiquetas', () => {
    const muitas = Array.from({ length: 20 }, (_, i) => `e${i}`);
    const estado = definirEtiquetas(estadoVazio(), alvo, muitas);
    expect(estado.registos[0].etiquetas).toHaveLength(MAX_ETIQUETAS);
  });

  it('esvazia a lista quando não há etiquetas', () => {
    const com = definirEtiquetas(estadoVazio(), alvo, ['x']);
    expect(definirEtiquetas(com, alvo, []).registos[0].etiquetas).toEqual([]);
  });
});

describe('podarRegistos', () => {
  const outro = { printerId: 'p1', nome: '/local/outro.gcode' };
  const saturno = { printerId: 's1', nome: '/local/resina.ctb' };

  it('esquece ficheiros que já não existem na impressora', () => {
    let estado = marcarFavorito(estadoVazio(), alvo, true);
    estado = marcarFavorito(estado, outro, true);
    const podado = podarRegistos(estado, { p1: ['/local/outro.gcode'] });
    expect(podado.registos.map(r => r.nome)).toEqual(['/local/outro.gcode']);
  });

  it('mantém as impressoras que não responderam', () => {
    let estado = marcarFavorito(estadoVazio(), alvo, true);
    estado = marcarFavorito(estado, saturno, true);
    const podado = podarRegistos(estado, { p1: [] });
    expect(podado.registos.map(r => r.printerId)).toEqual(['s1']);
  });

  it('devolve o mesmo objecto quando não há nada para podar', () => {
    const estado = marcarFavorito(estadoVazio(), alvo, true);
    expect(podarRegistos(estado, { p1: ['/local/peça.gcode'] })).toBe(estado);
  });
});

describe('resumoDoRegisto', () => {
  it('devolve valores vazios para um ficheiro desconhecido', () => {
    expect(resumoDoRegisto(estadoVazio(), alvo)).toEqual({
      favorito: false,
      reimpressoes: 0,
      ultimaImpressao: undefined,
      etiquetas: [],
    });
  });
});
