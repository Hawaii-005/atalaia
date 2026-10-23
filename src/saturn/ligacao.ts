// Ligação a uma impressora de resina Elegoo (SDCP V1 sobre MQTT).
//
// Ao contrário da Centauri Carbon (que é um servidor WebSocket em :3030), a
// Saturn 3 Ultra só responde a UDP :3000 e, para ser controlada, tem de ser
// *mandada ligar-se* a um broker MQTT nosso (pacote UDP "M66666 <porta>"), onde
// subscreve /sdcp/request/<MainboardID> e publica status/attributes/response.
// Os ficheiros (.goo/.ctb) são servidos por HTTP a partir da app, e a
// impressora vai buscá-los quando recebe o comando 256.

import {
  bytesUtf8,
  connack,
  decodificarTexto,
  lerConnect,
  puback,
  lerMensagens,
  lerPublicacao,
  lerSubscricao,
  pingresp,
  publicar,
  suback,
} from './protocolo';

export interface SocketSaturno {
  on(evento: 'data' | 'close' | 'error', cb: (dados?: any) => void): void;
  write(dados: Uint8Array): void;
  /** Escrita que espera pelo `drain` do socket (opcional no harness Node). */
  escrever?(dados: Uint8Array): Promise<void>;
  end(): void;
  destroy(): void;
}

export interface ServidorSaturno {
  on(evento: 'error', cb: (erro: any) => void): void;
  listen(opcoes: { port: number; host: string }, cb: () => void): void;
  address(): { port: number } | null;
  close(cb?: () => void): void;
}

export interface RedeSaturno {
  criarServidor(aoLigar: (socket: SocketSaturno) => void): ServidorSaturno;
  enviarUdp(mensagem: string, porta: number, ip: string): void;
  lerFicheiro(uri: string, posicao: number, tamanho: number): Promise<Uint8Array>;
  tamanhoFicheiro(uri: string): Promise<number>;
  md5Ficheiro(uri: string): Promise<string>;
}

export interface EstadoResina {
  CurrentStatus: number;
  PreviousStatus: number;
  PrintInfo: {
    Status: number;
    CurrentLayer: number;
    TotalLayer: number;
    CurrentTicks: number;
    TotalTicks: number;
    ErrorNumber: number;
    Filename: string;
  };
  FileTransferInfo: {
    Status: number;
    DownloadOffset: number;
    CheckOffset: number;
    FileTotalSize: number;
    Filename: string;
  };
}

export interface AtributosResina {
  Name?: string;
  MachineName?: string;
  ProtocolVersion?: string;
  FirmwareVersion?: string;
  MainboardIP?: string;
  MainboardID?: string;
  Capabilities?: string[];
}

export interface EventosSaturno {
  aoEstado?: (estado: EstadoResina) => void;
  aoLigar?: () => void;
  aoDesligar?: (motivo: string) => void;
  aoTransferir?: (enviado: number, total: number) => void;
}

const PORTA_UDP = 3000;
const TEMPO_LIGACAO_MS = 15000;
const TEMPO_PEDIDO_MS = 8000;
const TEMPO_TRANSFERENCIA_MS = 20 * 60 * 1000;
const LIMITE_BLOCO = 1024 * 1024;

const agora = () => Date.now();

const hexAleatorio = (bytes: number) => {
  const digitos = '0123456789abcdef';
  let saida = '';
  for (let i = 0; i < bytes * 2; i += 1) {
    saida += digitos[Math.floor(Math.random() * 16)];
  }
  return saida;
};

/** Estado bruto do firmware, normalizado para o formato do SDCP da app. */
export const normalizarEstado = (bruto: any): EstadoResina => {
  const info = bruto?.PrintInfo ?? {};
  const transferencia = bruto?.FileTransferInfo ?? {};
  return {
    CurrentStatus: Number(bruto?.CurrentStatus ?? 0),
    PreviousStatus: Number(bruto?.PreviousStatus ?? 0),
    PrintInfo: {
      Status: Number(info.Status ?? 0),
      CurrentLayer: Number(info.CurrentLayer ?? 0),
      TotalLayer: Number(info.TotalLayer ?? 0),
      CurrentTicks: Number(info.CurrentTicks ?? 0),
      TotalTicks: Number(info.TotalTicks ?? 0),
      ErrorNumber: Number(info.ErrorNumber ?? 0),
      Filename: String(info.Filename ?? ''),
    },
    FileTransferInfo: {
      Status: Number(transferencia.Status ?? 0),
      DownloadOffset: Number(transferencia.DownloadOffset ?? 0),
      CheckOffset: Number(transferencia.CheckOffset ?? 0),
      FileTotalSize: Number(transferencia.FileTotalSize ?? 0),
      Filename: String(transferencia.Filename ?? ''),
    },
  };
};

export class LigacaoSaturno {
  private rede: RedeSaturno;
  private eventos: EventosSaturno;
  private ip = '';
  private ident = '';
  private mainboardId = '';
  private mqtt: ServidorSaturno | null = null;
  private http: ServidorSaturno | null = null;
  private portaMqtt = 0;
  private portaHttp = 0;
  private cliente: SocketSaturno | null = null;
  private bufferMqtt: Uint8Array = new Uint8Array(0);
  private pedidos = new Map<string, { resolver: (v: any) => void; rejeitar: (e: any) => void; relogio: any }>();
  private atributos: AtributosResina = {};
  private rotas = new Map<string, { uri: string; tamanho: number }>();
  private transferencia: { resolver: () => void; rejeitar: (e: any) => void } | null = null;
  private aoProgresso: ((enviado: number, total: number) => void) | null = null;
  private ligado = false;
  private ligando: Promise<AtributosResina> | null = null;
  private estadoRecebido = false;
  private ultimoTick = -1;
  private desdeTick = 0;
  private emPausa = false;
  private parado = false;

  constructor(rede: RedeSaturno, eventos: EventosSaturno = {}) {
    this.rede = rede;
    this.eventos = eventos;
  }

  get estaLigado() {
    return this.ligado;
  }

  get dadosAtributos() {
    return this.atributos;
  }

  /**
   * Arranca os servidores, manda a impressora ligar-se e fica à escuta.
   * Duas chamadas ao mesmo tempo partilham a mesma promessa: sem isto a
   * segunda destruía os servidores da primeira.
   */
  ligar(ip: string, ident: string, mainboardId: string): Promise<AtributosResina> {
    if (this.ligando) return this.ligando;
    this.ligando = this.ligarInterno(ip, ident, mainboardId).finally(() => {
      this.ligando = null;
    });
    return this.ligando;
  }

  private async ligarInterno(
    ip: string,
    ident: string,
    mainboardId: string
  ): Promise<AtributosResina> {
    await this.desligar(false);
    this.parado = false;
    this.ip = ip;
    this.ident = ident;
    this.mainboardId = mainboardId;
    this.bufferMqtt = new Uint8Array(0);
    this.ultimoTick = -1;
    this.emPausa = false;
    this.atributos = {};
    this.estadoRecebido = false;

    const ligacao = new Promise<void>((resolver, rejeitar) => {
      const relogio = setTimeout(() => {
        rejeitar(new Error('A impressora não abriu a ligação MQTT.'));
      }, TEMPO_LIGACAO_MS);
      this.aoSubscrever = () => {
        clearTimeout(relogio);
        resolver();
      };
      this.aoSubscreverErro = (erro: any) => {
        clearTimeout(relogio);
        rejeitar(erro);
      };
    });

    this.mqtt = this.rede.criarServidor(socket => this.receberCliente(socket));
    this.http = this.rede.criarServidor(socket => this.receberHttp(socket));

    this.portaMqtt = await this.abrirServidor(this.mqtt);
    this.portaHttp = await this.abrirServidor(this.http);

    this.rede.enviarUdp(`M66666 ${this.portaMqtt}`, PORTA_UDP, ip);
    // O firmware às vezes perde o primeiro datagrama quando acabou de acordar.
    setTimeout(() => {
      if (!this.ligado) this.rede.enviarUdp(`M66666 ${this.portaMqtt}`, PORTA_UDP, this.ip);
    }, 800);

    try {
      await ligacao;
    } catch (erro) {
      // Sem subscrição não há sessão: fechar servidores e portas já abertos.
      await this.desligar(false);
      throw erro;
    }
    this.ligado = true;

    await this.pedido(0, null, TEMPO_PEDIDO_MS).catch(() => undefined);
    await this.pedido(1, null, TEMPO_PEDIDO_MS).catch(() => undefined);
    await this.pedido(512, { TimePeriod: 5000 }, TEMPO_PEDIDO_MS).catch(() => undefined);

    // Se o 512 se perder, a impressora não publica estado nenhum e a UI fica
    // "ligada" e morta. Repete-se o pedido até chegar o primeiro estado.
    let tentativas = 0;
    const relogioEstado = setInterval(() => {
      tentativas += 1;
      if (this.estadoRecebido || tentativas > 5 || !this.ligado) {
        clearInterval(relogioEstado);
        return;
      }
      this.pedido(512, { TimePeriod: 5000 }, TEMPO_PEDIDO_MS).catch(() => undefined);
      this.pedido(0, null, TEMPO_PEDIDO_MS).catch(() => undefined);
    }, 4000);

    this.eventos.aoLigar?.();
    return this.atributos;
  }

  private aoSubscrever: (() => void) | null = null;
  private aoSubscreverErro: ((erro: any) => void) | null = null;

  private abrirServidor(servidor: ServidorSaturno): Promise<number> {
    return new Promise((resolver, rejeitar) => {
      servidor.on('error', rejeitar);
      servidor.listen({ port: 0, host: '0.0.0.0' }, () => {
        const endereco = servidor.address();
        resolver(endereco?.port ?? 0);
      });
    });
  }

  private receberCliente(socket: SocketSaturno) {
    // Só interessa uma impressora: uma ligação nova substitui a anterior.
    if (this.cliente) {
      try {
        this.cliente.destroy();
      } catch {
        // ignore
      }
    }
    this.cliente = socket;
    this.bufferMqtt = new Uint8Array(0);

    socket.on('data', dados => {
      const bytes = dados instanceof Uint8Array ? dados : new Uint8Array(dados ?? []);
      const juntos = new Uint8Array(this.bufferMqtt.length + bytes.length);
      juntos.set(this.bufferMqtt, 0);
      juntos.set(bytes, this.bufferMqtt.length);
      const { mensagens, resto } = lerMensagens(juntos);
      // Um pacote corrompido não pode fazer crescer o buffer sem fim.
      if (resto.length > 1024 * 1024) {
        socket.destroy();
        return;
      }
      this.bufferMqtt = resto;
      mensagens.forEach(mensagem => this.tratarMensagem(socket, mensagem));
    });

    socket.on('error', () => undefined);
    socket.on('close', () => {
      // Um socket substituído a fechar não pode derrubar a ligação nova.
      if (this.cliente !== socket) return;
      this.cliente = null;
      this.rejeitarPendentes(new Error('A impressora fechou a ligação.'));
      if (this.ligado && !this.parado) {
        this.ligado = false;
        this.eventos.aoDesligar?.('A impressora fechou a ligação.');
      }
    });
  }

  private tratarMensagem(socket: SocketSaturno, mensagem: { tipo: number; flags: number; payload: Uint8Array }) {
    switch (mensagem.tipo) {
      case 1: {
        // CONNECT
        const cliente = lerConnect(mensagem.payload);
        // O clientId do CONNECT é a fonte da verdade: se o ID guardado estiver
        // velho, os pedidos iriam para um tópico que ninguém subscreve.
        if (cliente) this.mainboardId = cliente;
        socket.write(connack());
        break;
      }
      case 8: {
        // SUBSCRIBE
        const { idPacote, topico } = lerSubscricao(mensagem.payload);
        socket.write(suback(idPacote));
        if (topico.startsWith('/sdcp/request/')) {
          const resolver = this.aoSubscrever;
          this.aoSubscrever = null;
          resolver?.();
        }
        break;
      }
      case 3: {
        // PUBLISH
        const { topico, texto, qos, idPacote } = lerPublicacao(
          mensagem.payload,
          mensagem.flags
        );
        // A impressora publica o estado com QoS 1 e só continua depois do ACK.
        if (qos > 0) socket.write(puback(idPacote));
        this.tratarPublicacao(topico, texto);
        break;
      }
      case 12:
        socket.write(pingresp());
        break;
      case 14:
        socket.end();
        break;
      default:
        break;
    }
  }

  private tratarPublicacao(topico: string, texto: string) {
    let conteudo: any;
    try {
      conteudo = JSON.parse(texto);
    } catch {
      return;
    }
    const dados = conteudo?.Data ?? {};
    if (topico.startsWith('/sdcp/status/')) {
      this.processarEstado(normalizarEstado(dados.Status ?? dados));
    } else if (topico.startsWith('/sdcp/attributes/')) {
      if (dados.Attributes) {
        this.atributos = { ...this.atributos, ...dados.Attributes };
      }
      if (dados.Status) {
        this.processarEstado(normalizarEstado(dados.Status));
      }
    } else if (topico.startsWith('/sdcp/response/')) {
      const pedido = this.pedidos.get(String(dados.RequestID ?? ''));
      if (!pedido) return;
      this.pedidos.delete(String(dados.RequestID));
      clearTimeout(pedido.relogio);
      const resposta = dados.Data ?? {};
      if (typeof resposta.Ack === 'number' && resposta.Ack !== 0) {
        pedido.rejeitar(new Error(`A impressora recusou (Ack ${resposta.Ack}).`));
      } else {
        pedido.resolver(resposta);
      }
    }
  }

  /**
   * O firmware não diz "estou em pausa": o que para é o contador de ticks.
   * Mantém-se o estado normalizado com o código 20 (pausa) enquanto o
   * contador não mexer, para o resto da app não precisar de saber disto.
   */
  private rejeitarPendentes(erro: Error) {
    this.pedidos.forEach(({ relogio, rejeitar }) => {
      clearTimeout(relogio);
      rejeitar(erro);
    });
    this.pedidos.clear();
    const transferencia = this.transferencia;
    this.transferencia = null;
    transferencia?.rejeitar(erro);
  }

  private processarEstado(estado: EstadoResina) {
    this.estadoRecebido = true;
    if (estado.FileTransferInfo.Status !== 0) {
      this.eventos.aoTransferir?.(
        estado.FileTransferInfo.DownloadOffset,
        estado.FileTransferInfo.FileTotalSize
      );
      this.aoProgresso?.(
        estado.FileTransferInfo.DownloadOffset,
        estado.FileTransferInfo.FileTotalSize
      );
    }

    if (this.transferencia && estado.CurrentStatus !== 2) {
      const status = estado.FileTransferInfo.Status;
      if (status === 2) {
        const pendente = this.transferencia;
        this.transferencia = null;
        pendente.resolver();
      } else if (status === 3) {
        const pendente = this.transferencia;
        this.transferencia = null;
        pendente.rejeitar(new Error('A impressora recusou o ficheiro.'));
      }
    }

    const ticks = estado.PrintInfo.CurrentTicks;
    const agoraMs = agora();
    if (ticks !== this.ultimoTick) {
      this.ultimoTick = ticks;
      this.desdeTick = agoraMs;
      this.emPausa = false;
    } else if (!this.emPausa && agoraMs - this.desdeTick > 6000) {
      this.emPausa = true;
    }

    const aImprimir =
      !!estado.PrintInfo.Filename && ![0, 16].includes(estado.PrintInfo.Status);
    this.eventos.aoEstado?.({
      ...estado,
      PrintInfo: {
        ...estado.PrintInfo,
        Status: this.emPausa && aImprimir ? 20 : estado.PrintInfo.Status,
      },
    });
  }

  /** Envia um comando SDCP e resolve com a resposta da impressora. */
  pedido(cmd: number, dados: any = null, tempoLimiteMs = TEMPO_PEDIDO_MS): Promise<any> {
    return new Promise((resolver, rejeitar) => {
      const cliente = this.cliente;
      if (!cliente) {
        rejeitar(new Error('Impressora não ligada.'));
        return;
      }
      const id = hexAleatorio(16);
      const corpo = JSON.stringify({
        Data: {
          Cmd: cmd,
          Data: dados,
          From: 0,
          MainboardID: this.mainboardId,
          RequestID: id,
          TimeStamp: agora(),
        },
        Id: this.ident,
      });
      const relogio = setTimeout(() => {
        this.pedidos.delete(id);
        rejeitar(new Error('A impressora não respondeu ao comando.'));
      }, tempoLimiteMs);
      this.pedidos.set(id, { resolver, rejeitar, relogio });
      cliente.write(publicar(`/sdcp/request/${this.mainboardId}`, corpo));
    });
  }

  private receberHttp(socket: SocketSaturno) {
    let pedido = '';
    let servido = false;
    socket.on('error', () => undefined);
    socket.on('data', dados => {
      if (servido) return;
      pedido += decodificarTexto(
        dados instanceof Uint8Array ? dados : new Uint8Array(dados ?? [])
      );
      if (!pedido.includes('\r\n\r\n') && pedido.length < 4096) return;
      servido = true;
      const linha = pedido.split('\r\n')[0] ?? '';
      const metodo = linha.split(' ')[0] ?? 'GET';
      const caminho = linha.split(' ')[1] ?? '/';
      const rota = this.rotas.get(caminho);
      if (!rota) {
        socket.write(bytesUtf8('HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n'));
        socket.end();
        return;
      }
      const cabecalho =
        'HTTP/1.1 200 OK\r\n' +
        'Content-Type: application/octet-stream\r\n' +
        `Content-Length: ${rota.tamanho}\r\n` +
        'Connection: close\r\n\r\n';
      socket.write(bytesUtf8(cabecalho));
      if (metodo === 'HEAD') {
        socket.end();
        return;
      }
      this.enviarFicheiro(socket, rota.uri, rota.tamanho)
        .then(() => socket.end())
        .catch(() => socket.destroy());
    });
  }

  private async enviarFicheiro(socket: SocketSaturno, uri: string, tamanho: number) {
    for (let posicao = 0; posicao < tamanho; posicao += LIMITE_BLOCO) {
      const bloco = await this.rede.lerFicheiro(
        uri,
        posicao,
        Math.min(LIMITE_BLOCO, tamanho - posicao)
      );
      // Um .goo de 200 MB não cabe em memória: espera-se que o buffer nativo
      // escoe antes de ler o bloco seguinte (o adaptador expõe `drain`).
      if (socket.escrever) {
        await socket.escrever(bloco);
      } else {
        socket.write(bloco);
        await new Promise(resolver => setTimeout(resolver, 0));
      }
    }
  }

  /** Envia um .goo/.ctb para a impressora (comando 256 + HTTP local). */
  async carregar(
    uri: string,
    nome: string,
    onProgresso?: (enviado: number, total: number) => void
  ): Promise<void> {
    if (!this.http) throw new Error('Servidor de ficheiros não iniciado.');
    if (this.transferencia) {
      throw new Error('Já está uma transferência em curso.');
    }
    const tamanho = await this.rede.tamanhoFicheiro(uri);
    if (!tamanho) throw new Error('Ficheiro vazio.');
    const md5 = await this.rede.md5Ficheiro(uri);
    const extensao = (nome.split('.').pop() ?? 'goo').toLowerCase();
    const caminho = `/${hexAleatorio(16)}.${extensao}`;
    this.rotas.set(caminho, { uri, tamanho });

    this.aoProgresso = onProgresso ?? null;
    const conclusao = new Promise<void>((resolver, rejeitar) => {
      const relogio = setTimeout(() => {
        this.transferencia = null;
        rejeitar(new Error('A transferência não terminou.'));
      }, TEMPO_TRANSFERENCIA_MS);
      this.transferencia = {
        resolver: () => {
          clearTimeout(relogio);
          resolver();
        },
        rejeitar: erro => {
          clearTimeout(relogio);
          rejeitar(erro);
        },
      };
    });

    try {
      await this.pedido(
        256,
        {
          Check: 0,
          CleanCache: 1,
          Compress: 0,
          FileSize: tamanho,
          Filename: nome,
          MD5: md5,
          URL: `http://\${ipaddr}:${this.portaHttp}${caminho}`,
        },
        15000
      );
      await conclusao;
    } finally {
      this.rotas.delete(caminho);
      this.aoProgresso = null;
    }
  }

  /** Começa a imprimir um ficheiro que já esteja na impressora. */
  imprimir(nome: string, camadaInicial = 0) {
    return this.pedido(128, { Filename: nome, StartLayer: camadaInicial }, 15000);
  }

  pausar() {
    return this.pedido(129, null);
  }

  retomar() {
    return this.pedido(131, null);
  }

  pararImpressao() {
    return this.pedido(130, null);
  }

  async desligar(despedir = true) {
    this.parado = true;
    if (despedir && this.cliente) {
      // Comando 64 = desligar: liberta a impressora para o Chitubox.
      await this.pedido(64, null, 2000).catch(() => undefined);
    }
    this.ligado = false;
    this.rejeitarPendentes(new Error('Ligação fechada.'));
    this.rotas.clear();
    try {
      this.cliente?.destroy();
    } catch {
      // ignore
    }
    this.cliente = null;
    const fechar = (servidor: ServidorSaturno | null) =>
      new Promise<void>(resolver => {
        if (!servidor) return resolver();
        try {
          servidor.close(() => resolver());
        } catch {
          resolver();
        }
      });
    await fechar(this.mqtt);
    await fechar(this.http);
    this.mqtt = null;
    this.http = null;
  }
}
