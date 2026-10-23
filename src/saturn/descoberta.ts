// Pergunta directa a uma impressora de resina por UDP: ao contrário da
// Centauri, a Saturn responde a "M99999" enviado para o IP dela (não é preciso
// broadcast) com os atributos e o estado, sem abrir ligação nenhuma.

import dgram from 'react-native-udp';
import { Buffer } from 'buffer';

export interface RespostaSaturno {
  id: string;
  atributos: {
    Name?: string;
    MachineName?: string;
    FirmwareVersion?: string;
    MainboardID?: string;
    ProtocolVersion?: string;
    MainboardIP?: string;
  };
}

const PORTA = 3000;
const ESPERA_MS = 2500;

/** Envia `M99999` a um IP e devolve a primeira resposta válida. */
export const inquirirSaturno = (ip: string): Promise<RespostaSaturno> =>
  new Promise((resolver, rejeitar) => {
    let socket: any = null;
    let terminado = false;
    const fechar = (erro?: Error) => {
      if (terminado) return;
      terminado = true;
      try {
        socket?.close();
      } catch {
        // já fechado
      }
      if (erro) rejeitar(erro);
    };

    const relogio = setTimeout(
      () => fechar(new Error('A impressora não respondeu por UDP.')),
      ESPERA_MS
    );

    try {
      socket = dgram.createSocket({ type: 'udp4' });
      socket.on('error', (erro: any) => {
        clearTimeout(relogio);
        fechar(erro instanceof Error ? erro : new Error('Erro de rede.'));
      });
      socket.on('message', (dados: any) => {
        try {
          const texto = Buffer.isBuffer(dados) ? dados.toString('utf8') : String(dados);
          const corpo = JSON.parse(texto);
          const atributos = corpo?.Data?.Attributes;
          if (!atributos?.MainboardID) return;
          clearTimeout(relogio);
          resolver({
            id: String(corpo?.Id ?? ''),
            atributos: {
              Name: atributos.Name,
              MachineName: atributos.MachineName,
              FirmwareVersion: atributos.FirmwareVersion,
              MainboardID: atributos.MainboardID,
              ProtocolVersion: atributos.ProtocolVersion,
              MainboardIP: atributos.MainboardIP,
            },
          });
          fechar();
        } catch {
          // resposta de outra coisa
        }
      });
      socket.bind(0, () => {
        socket.send('M99999', 0, 6, PORTA, ip);
      });
    } catch (erro) {
      clearTimeout(relogio);
      fechar(erro instanceof Error ? erro : new Error('Erro de rede.'));
    }
  });
