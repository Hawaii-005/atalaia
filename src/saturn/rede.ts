// Adaptador React Native para a ligação da Saturn 3 Ultra: sockets TCP
// (servidor MQTT e servidor HTTP), leitura de ficheiros por blocos e UDP.

import TcpSocket from 'react-native-tcp-socket';
import * as FileSystem from 'expo-file-system';
import dgram from 'react-native-udp';
import SparkMD5 from 'spark-md5';
import { Buffer } from 'buffer';
import { decodeBase64 } from '../utils/gcodeUpload';
import { RedeSaturno, ServidorSaturno, SocketSaturno } from './ligacao';

const BLOCO_MD5 = 1024 * 1024;

const adaptarSocket = (socket: any): SocketSaturno => ({
  on: (evento, cb) => {
    const nome = evento === 'data' ? 'data' : evento;
    socket.on(nome, (dados: any) => cb(dados));
  },
  write: dados => {
    socket.write(Buffer.from(dados));
  },
  // Escrita com contrapressão: um .goo de 200 MB não pode ficar todo em fila
  // na memória nativa. Espera pelo `drain` quando o buffer está cheio.
  escrever: dados =>
    new Promise<void>(resolver => {
      socket.write(Buffer.from(dados), undefined, () => {
        if (socket.writableNeedDrain && typeof socket.once === 'function') {
          const aoDrenar = () => resolver();
          socket.once('drain', aoDrenar);
          // Rede morta a meio: não deixar a promessa pendurada para sempre.
          setTimeout(() => {
            try {
              socket.removeListener?.('drain', aoDrenar);
            } catch {
              // ignore
            }
            resolver();
          }, 15000);
        } else {
          resolver();
        }
      });
    }),
  end: () => {
    try {
      socket.end();
    } catch {
      // já fechado
    }
  },
  destroy: () => {
    try {
      socket.destroy();
    } catch {
      // já fechado
    }
  },
});

const adaptarServidor = (servidor: any): ServidorSaturno => ({
  on: (evento, cb) => servidor.on(evento, (erro: any) => cb(erro)),
  listen: (opcoes, cb) =>
    servidor.listen({ port: opcoes.port, host: opcoes.host }, cb),
  address: () => servidor.address(),
  close: cb => servidor.close(() => cb?.()),
});

export const redeSaturno: RedeSaturno = {
  criarServidor(aoLigar) {
    const servidor = TcpSocket.createServer((socket: any) => {
      aoLigar(adaptarSocket(socket));
    });
    return adaptarServidor(servidor);
  },

  enviarUdp(mensagem, porta, ip) {
    const socket = dgram.createSocket({ type: 'udp4' });
    try {
      socket.bind(0, () => {
        socket.send(mensagem, 0, mensagem.length, porta, ip, () => {
          setTimeout(() => {
            try {
              socket.close();
            } catch {
              // já fechado
            }
          }, 300);
        });
      });
    } catch {
      try {
        socket.close();
      } catch {
        // ignore
      }
    }
  },

  async lerFicheiro(uri, posicao, tamanho) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: posicao,
      length: tamanho,
    });
    return decodeBase64(base64);
  },

  async tamanhoFicheiro(uri) {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    return (info as { size?: number }).size ?? 0;
  },

  async md5Ficheiro(uri) {
    const total = await this.tamanhoFicheiro(uri);
    const spark = new SparkMD5.ArrayBuffer();
    for (let posicao = 0; posicao < total; posicao += BLOCO_MD5) {
      const bytes = await this.lerFicheiro(
        uri,
        posicao,
        Math.min(BLOCO_MD5, total - posicao)
      );
      spark.append(bytes.buffer as ArrayBuffer);
    }
    return spark.end();
  },
};
