// Codec mínimo do MQTT 3.1.1 usado pelo SDCP V1 das impressoras de resina
// (Saturn 3 Ultra): a impressora liga-se *a nós* como cliente MQTT, por isso
// a app tem de fazer de servidor. Não há dependências: só o essencial para
// CONNECT/SUBSCRIBE/PUBLISH/PING.

export interface MqttMensagem {
  tipo: number;
  flags: number;
  payload: Uint8Array;
}

export interface ResultadoLeitura {
  mensagens: MqttMensagem[];
  resto: Uint8Array;
}

const textoUtf8 = (bytes: Uint8Array): string => {
  let saida = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 0x80) {
      saida += String.fromCharCode(c);
    } else if (c < 0xe0) {
      saida += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else if (c < 0xf0) {
      saida += String.fromCharCode(
        ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
      );
    } else {
      const ponto =
        ((c & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
      const ajustado = ponto - 0x10000;
      saida += String.fromCharCode(0xd800 + (ajustado >> 10), 0xdc00 + (ajustado & 0x3ff));
    }
  }
  return saida;
};

/** Bytes UTF-8, para cabeçalhos HTTP e nomes com acentos. */
export const bytesUtf8 = (texto: string): Uint8Array => {
  const bytes: number[] = [];
  for (let i = 0; i < texto.length; i += 1) {
    let ponto = texto.charCodeAt(i);
    if (ponto >= 0xd800 && ponto <= 0xdbff && i + 1 < texto.length) {
      const baixo = texto.charCodeAt(i + 1);
      if (baixo >= 0xdc00 && baixo <= 0xdfff) {
        ponto = 0x10000 + ((ponto - 0xd800) << 10) + (baixo - 0xdc00);
        i += 1;
      }
    }
    if (ponto < 0x80) {
      bytes.push(ponto);
    } else if (ponto < 0x800) {
      bytes.push(0xc0 | (ponto >> 6), 0x80 | (ponto & 0x3f));
    } else if (ponto < 0x10000) {
      bytes.push(0xe0 | (ponto >> 12), 0x80 | ((ponto >> 6) & 0x3f), 0x80 | (ponto & 0x3f));
    } else {
      bytes.push(
        0xf0 | (ponto >> 18),
        0x80 | ((ponto >> 12) & 0x3f),
        0x80 | ((ponto >> 6) & 0x3f),
        0x80 | (ponto & 0x3f)
      );
    }
  }
  return Uint8Array.from(bytes);
};

const comprimento = (valor: number): number[] => {
  const saida: number[] = [];
  let resto = valor;
  do {
    let digito = resto % 128;
    resto = Math.floor(resto / 128);
    if (resto > 0) digito |= 0x80;
    saida.push(digito);
  } while (resto > 0);
  return saida;
};

export const codificarTexto = (texto: string): Uint8Array => {
  const bytes = bytesUtf8(texto);
  return Uint8Array.from([bytes.length >> 8, bytes.length & 0xff, ...Array.from(bytes)]);
};

/** Bytes UTF-8, para cabeçalhos HTTP e nomes com acentos. */
export const decodificarTexto = (bytes: Uint8Array): string => textoUtf8(bytes);

const pacote = (cabecalho: number, corpo: number[]): Uint8Array =>
  Uint8Array.from([cabecalho, ...comprimento(corpo.length), ...corpo]);

/** CONNACK: ligação aceite. */
export const connack = (): Uint8Array => pacote(0x20, [0x00, 0x00]);

/** SUBACK com QoS 0. */
export const suback = (idPacote: number): Uint8Array =>
  pacote(0x90, [idPacote >> 8, idPacote & 0xff, 0x00]);

export const pingresp = (): Uint8Array => Uint8Array.from([0xd0, 0x00]);

/**
 * PUBLISH como o firmware o espera: QoS 0 mas **com** o campo de id de pacote
 * (2 bytes) antes da mensagem. O Chitubox manda-o assim e a impressora
 * descarta publicações sem esses dois bytes — sem erro nenhum do lado dela.
 */
export const publicar = (topico: string, texto: string, idPacote = 1): Uint8Array => {
  const t = codificarTexto(topico);
  const corpo = [
    ...Array.from(t),
    idPacote >> 8,
    idPacote & 0xff,
    ...Array.from(bytesUtf8(texto)),
  ];
  return pacote(0x30, corpo);
};

export const lerMensagens = (dados: Uint8Array): ResultadoLeitura => {
  const mensagens: MqttMensagem[] = [];
  let posicao = 0;
  while (posicao < dados.length) {
    if (dados.length - posicao < 2) break;
    const cabecalho = dados[posicao];
    let multiplicador = 1;
    let tamanho = 0;
    let i = posicao + 1;
    let completo = false;
    for (; i < dados.length; i += 1) {
      const byte = dados[i];
      tamanho += (byte & 0x7f) * multiplicador;
      if ((byte & 0x80) === 0) {
        completo = true;
        i += 1;
        break;
      }
      multiplicador *= 128;
      if (multiplicador > 2097152) break;
    }
    if (!completo || i + tamanho > dados.length) break;
    mensagens.push({
      tipo: cabecalho >> 4,
      flags: cabecalho & 0x0f,
      payload: dados.slice(i, i + tamanho),
    });
    posicao = i + tamanho;
  }
  return { mensagens, resto: dados.slice(posicao) };
};

const lerCampoTexto = (payload: Uint8Array, posicao: number) => {
  const tamanho = (payload[posicao] << 8) | payload[posicao + 1];
  const inicio = posicao + 2;
  return { texto: textoUtf8(payload.slice(inicio, inicio + tamanho)), proximo: inicio + tamanho };
};

export const lerConnect = (payload: Uint8Array): string => {
  // 00 04 "MQTT" <nível> <flags> <keepalive> <id do cliente>
  const primeiro = lerCampoTexto(payload, 0);
  if (primeiro.texto !== 'MQTT') return '';
  return lerCampoTexto(payload, primeiro.proximo + 4).texto;
};

export const lerSubscricao = (payload: Uint8Array) => {
  const idPacote = (payload[0] << 8) | payload[1];
  const topico = lerCampoTexto(payload, 2).texto;
  return { idPacote, topico };
};

export const lerPublicacao = (payload: Uint8Array, flags: number) => {
  const topico = lerCampoTexto(payload, 0);
  const qos = (flags >> 1) & 0x03;
  let idPacote = 0;
  if (qos > 0) {
    idPacote = (payload[topico.proximo] << 8) | payload[topico.proximo + 1];
  }
  const inicio = topico.proximo + (qos > 0 ? 2 : 0);
  return { topico: topico.texto, texto: textoUtf8(payload.slice(inicio)), qos, idPacote };
};

/** PUBACK: a impressora publica o estado com QoS 1 e espera confirmação. */
export const puback = (idPacote: number): Uint8Array =>
  Uint8Array.from([0x40, 0x02, idPacote >> 8, idPacote & 0xff]);
