import {
  ItemFila,
  aguardarAck,
  bloquear,
  cancelar,
  concluir,
  criarItem,
  iniciarEnvio,
  moverNaFila,
  podeReordenar,
  podeTransitar,
  proximoDaFila,
  registarAck,
  removerPedeConfirmacao,
  sanearAoCarregar,
  semResposta,
  transitar,
  TransicaoInvalida,
} from '../src/utils/fila/modelo';

const AGORA = 1_700_000_000_000;

const novo = (id = 'a', printerId = 'p1'): ItemFila =>
  criarItem({
    id,
    printerId,
    name: `${id}.gcode`,
    label: `${id}.gcode`,
    agora: AGORA,
    opcoes: { nivelar: false, lado: 0 },
  });

const emEspera = (id = 'a'): ItemFila => {
  const inicio = iniciarEnvio(novo(id), 't1', AGORA);
  if (!inicio.ok) throw new Error('envio recusado');
  return aguardarAck(inicio.item, 't1', AGORA);
};

describe('máquina de estados', () => {
  it('percorre o caminho feliz até «concluído»', () => {
    let item = novo();
    expect(item.estado).toBe('pendente');

    const inicio = iniciarEnvio(item, 't1', AGORA + 1);
    if (!inicio.ok) throw new Error('devia aceitar');
    item = aguardarAck(inicio.item, 't1', AGORA + 2);
    expect(item.estado).toBe('aEsperaAck');

    const ack = registarAck(item, 't1', 0, AGORA + 3);
    expect(ack.aplicado).toBe(true);
    item = concluir(ack.item, AGORA + 4);
    expect(item.estado).toBe('concluido');
  });

  it('rejeita transições que não existem', () => {
    expect(() => transitar(novo(), 'aImprimir', AGORA)).toThrow(
      TransicaoInvalida
    );
    expect(podeTransitar('pendente', 'aImprimir')).toBe(false);

    const feito = concluir(registarAck(emEspera(), 't1', 0, AGORA).item, AGORA);
    expect(() => transitar(feito, 'pendente', AGORA)).toThrow(
      TransicaoInvalida
    );
  });

  it('não deixa cancelar um item já concluído', () => {
    const feito = concluir(registarAck(emEspera(), 't1', 0, AGORA).item, AGORA);
    expect(() => cancelar(feito, AGORA)).toThrow(TransicaoInvalida);
  });
});

describe('idempotência do arranque', () => {
  it('recusa um segundo envio do mesmo item', () => {
    const primeiro = iniciarEnvio(novo(), 't1', AGORA);
    expect(primeiro.ok).toBe(true);
    if (!primeiro.ok) return;

    const segundo = iniciarEnvio(primeiro.item, 't2', AGORA + 1);
    expect(segundo).toEqual({ ok: false, motivo: 'estado' });
    expect(primeiro.item.arranqueTentado).toBe(true);
  });

  it('ignora um Ack de outra tentativa', () => {
    const emCurso = emEspera();
    const resultado = registarAck(emCurso, 't-antiga', 0, AGORA + 10);
    expect(resultado.aplicado).toBe(false);
    expect(resultado.item).toBe(emCurso);
  });

  it('ignora um Ack repetido', () => {
    const emCurso = emEspera();
    const primeiro = registarAck(emCurso, 't1', 0, AGORA + 1);
    expect(primeiro.aplicado).toBe(true);
    const segundo = registarAck(primeiro.item, 't1', 0, AGORA + 2);
    expect(segundo.aplicado).toBe(false);
    expect(segundo.item.estado).toBe('aImprimir');
  });

  it('um item apanhado a meio do envio não é reenviado ao abrir a app', () => {
    const emCurso = emEspera();
    const [saneado] = sanearAoCarregar([emCurso], AGORA + 60_000);
    expect(saneado.estado).toBe('bloqueado');
    expect(saneado.motivo).toBe('envioInterrompido');
    expect(saneado.arranqueTentado).toBe(true);
    expect(saneado.tentativaId).toBeUndefined();
    expect(iniciarEnvio(saneado, 't2', AGORA + 60_001)).toEqual({
      ok: false,
      motivo: 'estado',
    });
  });

  it('uma recusa explícita volta a «pendente» e pode ser repetida', () => {
    const emCurso = emEspera();
    const recusa = registarAck(emCurso, 't1', 5, AGORA + 1);
    expect(recusa.aplicado).toBe(true);
    expect(recusa.item.estado).toBe('pendente');
    expect(recusa.item.motivo).toBe('ackRecusado');
    expect(recusa.item.tentativas).toBe(1);

    const outra = iniciarEnvio(recusa.item, 't2', AGORA + 2);
    expect(outra.ok).toBe(true);
  });

  it('passa a «falhou» ao fim de três recusas', () => {
    let item = emEspera();
    for (let i = 1; i <= 2; i += 1) {
      const recusa = registarAck(item, item.tentativaId!, 5, AGORA + i);
      const inicio = iniciarEnvio(recusa.item, `t${i + 1}`, AGORA + i);
      if (!inicio.ok) throw new Error('devia poder repetir');
      item = aguardarAck(inicio.item, `t${i + 1}`, AGORA + i);
    }
    const terceira = registarAck(item, item.tentativaId!, 5, AGORA + 9);
    expect(terceira.item.estado).toBe('falhou');
    expect(terceira.item.tentativas).toBe(3);
    expect(terceira.item.ackCode).toBe(5);
  });

  it('sem resposta fica bloqueado em vez de repetir o comando', () => {
    const bloqueado = semResposta(emEspera(), AGORA + 15_000);
    expect(bloqueado.estado).toBe('bloqueado');
    expect(bloqueado.motivo).toBe('envioInterrompido');
    expect(iniciarEnvio(bloqueado, 't2', AGORA + 20_000).ok).toBe(false);
  });
});

describe('fila por impressora', () => {
  it('só arranca o primeiro item pendente daquela impressora', () => {
    const aBloquear = bloquear(novo('a'), 'semLigacao', AGORA);
    const fila = [aBloquear, novo('b'), novo('c', 'p2')];
    expect(proximoDaFila(fila, 'p1')?.id).toBe('b');
    expect(proximoDaFila(fila, 'p2')?.id).toBe('c');
    expect(proximoDaFila(fila, 'p3')).toBeUndefined();
  });

  it('move um item sem mexer na ordem das outras impressoras', () => {
    const fila = [novo('a'), novo('x', 'p2'), novo('b'), novo('c')];
    const movida = moverNaFila(fila, 'c', 0);
    expect(movida.map(i => i.id)).toEqual(['c', 'x', 'a', 'b']);
  });

  it('não passa dos limites da lista', () => {
    const fila = [novo('a'), novo('b')];
    expect(moverNaFila(fila, 'a', 99).map(i => i.id)).toEqual(['b', 'a']);
    expect(moverNaFila(fila, 'a', -5).map(i => i.id)).toEqual(['a', 'b']);
  });

  it('não deixa arrastar o que está a imprimir ou à espera', () => {
    expect(podeReordenar(novo())).toBe(true);
    expect(podeReordenar(emEspera())).toBe(false);
    expect(podeReordenar(registarAck(emEspera(), 't1', 0, AGORA).item)).toBe(
      false
    );
  });

  it('só pede confirmação para remover o que já saiu para a impressora', () => {
    expect(removerPedeConfirmacao(novo())).toBe(false);
    expect(removerPedeConfirmacao(emEspera())).toBe(true);
  });
});
