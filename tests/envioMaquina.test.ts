import {
  SAIDAS,
  chaveErro,
  inicial,
  percentagem,
  podeRepetirLeitura,
  transitar,
  type Evento,
} from '../src/envio/maquina';
import type { ErroEnvio, Estado } from '../src/envio/tipos';

const correr = (eventos: Evento[], estado: Estado = inicial) => {
  let atual = estado;
  const aplicados: boolean[] = [];
  for (const evento of eventos) {
    const r = transitar(atual, evento);
    atual = r.estado;
    aplicados.push(r.aplicado);
  }
  return { estado: atual, aplicados };
};

describe('máquina de envio: caminho feliz', () => {
  test('pronto → aEnviar → enviado → aVerificar → verificado → aArrancar → iniciado', () => {
    const { estado, aplicados } = correr([
      { tipo: 'enviar', total: 1000 },
      { tipo: 'progresso', enviado: 400 },
      { tipo: 'progresso', enviado: 1000 },
      { tipo: 'uploadOk', remoto: 'gcodes/cubo-20261122-061008.gcode' },
      { tipo: 'verificar', agora: 1000 },
      { tipo: 'metadadosLidos', igual: true },
      { tipo: 'arrancar' },
      { tipo: 'arranqueOk' },
    ]);

    expect(aplicados.every(Boolean)).toBe(true);
    expect(estado).toEqual({
      fase: 'iniciado',
      remoto: 'gcodes/cubo-20261122-061008.gcode',
    });
  });

  test('o progresso nunca recua nem passa do total', () => {
    const a = correr([{ tipo: 'enviar', total: 100 }]);
    const b = correr([{ tipo: 'progresso', enviado: 80 }], a.estado);
    const c = correr([{ tipo: 'progresso', enviado: 30 }], b.estado);
    const d = correr([{ tipo: 'progresso', enviado: 999 }], c.estado);

    expect(percentagem(b.estado)).toBe(80);
    expect(percentagem(c.estado)).toBe(80);
    expect(percentagem(d.estado)).toBe(100);
  });
});

describe('máquina de envio: verificação com 404 temporário', () => {
  test('repete a leitura até 5 tentativas e só depois dá inconsistente', () => {
    let estado: Estado = correr([
      { tipo: 'enviar', total: 10 },
      { tipo: 'uploadOk', remoto: 'gcodes/a.gcode' },
      { tipo: 'verificar', agora: 0 },
    ]).estado;

    for (let i = 0; i < 5; i += 1) {
      const r = transitar(estado, { tipo: 'metadadosAusentes', agora: 100 });
      expect(r.aplicado).toBe(true);
      estado = r.estado;
      if (estado.fase === 'aVerificar') {
        expect(estado.tentativa).toBe(i + 2);
      }
    }

    const fim = transitar(estado, { tipo: 'metadadosAusentes', agora: 100 });
    expect(fim.estado).toEqual({
      fase: 'falhou',
      erro: 'inconsistente',
      de: 'aVerificar',
      remoto: 'gcodes/a.gcode',
    });
  });

  test('o limite de tempo também fecha a verificação', () => {
    const { estado } = correr(
      [
        { tipo: 'verificar', agora: 0 },
        { tipo: 'metadadosAusentes', agora: 8001 },
      ],
      {
        fase: 'aVerificar',
        remoto: 'gcodes/a.gcode',
        tentativa: 1,
        desde: 0,
      }
    );
    expect(estado.fase).toBe('falhou');
  });

  test('podeRepetirLeitura respeita tentativas e prazo', () => {
    expect(podeRepetirLeitura(1, 0)).toBe(true);
    expect(podeRepetirLeitura(5, 0)).toBe(false);
    expect(podeRepetirLeitura(1, 8000)).toBe(false);
  });

  test('metadados diferentes dão ficheiro inconsistente', () => {
    const { estado } = correr(
      [
        { tipo: 'verificar', agora: 0 },
        { tipo: 'metadadosLidos', igual: false },
      ],
      { fase: 'enviado', remoto: 'gcodes/a.gcode' }
    );
    expect(estado).toMatchObject({ fase: 'falhou', erro: 'inconsistente' });
  });
});

describe('máquina de envio: erros e saídas', () => {
  test('cada erro tem saídas definidas e chave i18n própria', () => {
    const erros = Object.keys(SAIDAS) as ErroEnvio[];
    expect(new Set(erros.map(chaveErro)).size).toBe(erros.length);
    for (const erro of erros) {
      expect(SAIDAS[erro].length).toBeGreaterThan(0);
      if (erro === 'ocupada') expect(SAIDAS[erro]).toContain('fila');
    }
    expect(SAIDAS.ocupada).toEqual(['fila', 'resultado']);
    expect(SAIDAS.autenticacao).toEqual(['credenciais', 'resultado']);
    expect(SAIDAS.timeout).toContain('repetir');
  });

  test('falha de upload pára em falhou e guarda de onde veio', () => {
    const { estado } = correr(
      [
        { tipo: 'enviar', total: 10 },
        { tipo: 'falhaUpload', erro: 'autenticacao' },
      ],
      inicial
    );
    expect(estado).toEqual({
      fase: 'falhou',
      erro: 'autenticacao',
      de: 'aEnviar',
    });
  });

  test('cancelar a meio do envio não conta como sucesso', () => {
    const { estado } = correr([
      { tipo: 'enviar', total: 10 },
      { tipo: 'cancelar' },
    ]);
    expect(estado).toMatchObject({ fase: 'falhou', erro: 'cancelado' });
    expect(percentagem(estado)).toBe(0);
  });

  test('falha do print.start mantém o ficheiro remoto no estado', () => {
    const { estado } = correr([{ tipo: 'arranqueFalhou' }], {
      fase: 'aArrancar',
      remoto: 'gcodes/a.gcode',
    });
    expect(estado).toEqual({
      fase: 'falhou',
      erro: 'arranqueFalhou',
      de: 'aArrancar',
      remoto: 'gcodes/a.gcode',
    });
  });

  test('repor volta ao início, menos depois de iniciado', () => {
    expect(
      correr([{ tipo: 'repor' }], {
        fase: 'falhou',
        erro: 'timeout',
        de: 'aEnviar',
      }).estado
    ).toEqual(inicial);
    expect(
      transitar(
        { fase: 'iniciado', remoto: 'gcodes/a.gcode' },
        { tipo: 'repor' }
      ).aplicado
    ).toBe(false);
  });
});

describe('máquina de envio: eventos fora de tempo', () => {
  test('duplo arrancar não muda nada', () => {
    const aArrancar: Estado = { fase: 'aArrancar', remoto: 'gcodes/a.gcode' };
    const r = transitar(aArrancar, { tipo: 'arrancar' });
    expect(r.aplicado).toBe(false);
    expect(r.estado).toBe(aArrancar);
  });

  test('resposta de upload tardia é ignorada', () => {
    const falhou: Estado = { fase: 'falhou', erro: 'timeout', de: 'aEnviar' };
    const r = transitar(falhou, { tipo: 'uploadOk', remoto: 'gcodes/a.gcode' });
    expect(r.aplicado).toBe(false);
    expect(r.estado).toBe(falhou);
  });

  test('não se arranca sem estar verificado', () => {
    const r = transitar(
      { fase: 'enviado', remoto: 'gcodes/a.gcode' },
      { tipo: 'arrancar' }
    );
    expect(r.aplicado).toBe(false);
  });

  test('enviar sem total é recusado', () => {
    expect(transitar(inicial, { tipo: 'enviar', total: 0 }).aplicado).toBe(
      false
    );
  });
});
