import {
  connack,
  lerConnect,
  lerMensagens,
  lerPublicacao,
  lerSubscricao,
  publicar,
  puback,
  suback,
} from '../src/saturn/protocolo';
import { estadoParaApp, codigoParaApp } from '../src/saturn/estadoApp';
import { normalizarEstado } from '../src/saturn/ligacao';

const texto = (bytes: Uint8Array) => Buffer.from(bytes).toString('utf8');

/** Monta um CONNECT mínimo como o que a impressora envia. */
const connect = (clientId: string): Uint8Array => {
  const id = Buffer.from(clientId, 'utf8');
  const corpo = Buffer.concat([
    Buffer.from([0x00, 0x04]),
    Buffer.from('MQTT'),
    Buffer.from([0x04, 0x02, 0x00, 0x3c, id.length >> 8, id.length & 0xff]),
    id,
  ]);
  return Uint8Array.from([0x10, corpo.length, ...corpo]);
};

describe('codec MQTT do SDCP V1', () => {
  it('lê um CONNECT e devolve o clientId (MainboardID)', () => {
    const pacote = connect('38c9fb3777d00100');
    const { mensagens, resto } = lerMensagens(pacote);
    expect(resto.length).toBe(0);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0].tipo).toBe(1);
    expect(lerConnect(mensagens[0].payload)).toBe('38c9fb3777d00100');
  });

  it('junta um pacote partido em dois pedaços', () => {
    const pacote = connect('ABC123');
    const primeiro = lerMensagens(pacote.slice(0, 5));
    expect(primeiro.mensagens).toHaveLength(0);
    const segundo = lerMensagens(
      Uint8Array.from([...primeiro.resto, ...pacote.slice(5)])
    );
    expect(segundo.mensagens).toHaveLength(1);
    expect(lerConnect(segundo.mensagens[0].payload)).toBe('ABC123');
  });

  it('lê uma subscrição', () => {
    const topico = Buffer.from('/sdcp/request/38c9fb3777d00100');
    const corpo = Buffer.from([
      0x00,
      0x07,
      topico.length >> 8,
      topico.length & 0xff,
      ...topico,
      0x00,
    ]);
    const { mensagens } = lerMensagens(
      Uint8Array.from([0x82, corpo.length, ...corpo])
    );
    const sub = lerSubscricao(mensagens[0].payload);
    expect(sub.idPacote).toBe(7);
    expect(sub.topico).toBe('/sdcp/request/38c9fb3777d00100');
  });

  it('publica com os 2 bytes de id de pacote, mesmo em QoS 0', () => {
    const pacote = publicar('/sdcp/request/x', '{"a":1}');
    expect(pacote[0]).toBe(0x30);
    const { mensagens } = lerMensagens(pacote);
    const lido = lerPublicacao(mensagens[0].payload, mensagens[0].flags);
    expect(lido.topico).toBe('/sdcp/request/x');
    // O firmware conta com estes dois bytes antes do JSON.
    expect(lido.texto.charCodeAt(0)).toBe(0);
    expect(lido.texto.charCodeAt(1)).toBe(1);
    expect(lido.texto.slice(2)).toBe('{"a":1}');
  });

  it('decodifica uma publicação QoS 1 e devolve o id para o PUBACK', () => {
    const topico = Buffer.from('/sdcp/status/38c9fb3777d00100');
    const json = Buffer.from('{"Data":{}}');
    const corpo = Buffer.from([
      topico.length >> 8,
      topico.length & 0xff,
      ...topico,
      0x12,
      0x34,
      ...json,
    ]);
    const { mensagens } = lerMensagens(
      Uint8Array.from([0x32, corpo.length, ...corpo])
    );
    const lido = lerPublicacao(mensagens[0].payload, mensagens[0].flags);
    expect(lido.topico).toBe('/sdcp/status/38c9fb3777d00100');
    expect(lido.texto).toBe('{"Data":{}}');
    expect(lido.qos).toBe(1);
    expect(lido.idPacote).toBe(0x1234);
    expect(puback(0x1234)).toEqual(Uint8Array.from([0x40, 0x02, 0x12, 0x34]));
  });

  it('respostas fixas', () => {
    expect(connack()).toEqual(Uint8Array.from([0x20, 0x02, 0x00, 0x00]));
    expect(suback(9)).toEqual(Uint8Array.from([0x90, 0x03, 0x00, 0x09, 0x00]));
    expect(texto(publicar('a', 'b')).includes('a')).toBe(true);
  });
});

describe('estado da resina → formato da app', () => {
  const bruto = {
    CurrentStatus: 1,
    PreviousStatus: 0,
    PrintInfo: {
      Status: 2,
      CurrentLayer: 50,
      TotalLayer: 200,
      CurrentTicks: 600000,
      TotalTicks: 2400000,
      ErrorNumber: 0,
      Filename: 'peca.goo',
    },
    FileTransferInfo: { Status: 0 },
  };

  it('normaliza o estado bruto', () => {
    const estado = normalizarEstado(bruto);
    expect(estado.PrintInfo.Filename).toBe('peca.goo');
    expect(estado.PrintInfo.TotalTicks).toBe(2400000);
  });

  it('converte ticks de milissegundos para segundos e calcula o progresso', () => {
    const estado = estadoParaApp(normalizarEstado(bruto));
    expect(estado.PrintInfo.CurrentTicks).toBe(600);
    expect(estado.PrintInfo.TotalTicks).toBe(2400);
    expect(estado.PrintInfo.Progress).toBe(25);
    expect(estado.PrintInfo.Status).toBe(6);
    expect(estado.CurrentStatus).toEqual([1]);
  });

  it('mapeia os códigos conhecidos', () => {
    expect(codigoParaApp(0)).toBe(0);
    expect(codigoParaApp(2)).toBe(6);
    expect(codigoParaApp(16)).toBe(9);
    expect(codigoParaApp(20)).toBe(20);
    expect(codigoParaApp(99)).toBe(8);
  });

  it('concluída mostra 100%', () => {
    const estado = estadoParaApp(
      normalizarEstado({
        ...bruto,
        PrintInfo: { ...bruto.PrintInfo, Status: 16 },
      })
    );
    expect(estado.PrintInfo.Progress).toBe(100);
  });
});
