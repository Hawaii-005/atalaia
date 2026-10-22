// Erros centralizados da comunicação com a impressora SDCP.

// Erro de programação: o comando não cumpre o protocolo SDCP.
// Não deve chegar ao utilizador — corrige quem construiu o comando.
export class CommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandValidationError';
    // Garante que `instanceof` funciona após transpilação.
    Object.setPrototypeOf(this, CommandValidationError.prototype);
  }
}

// Impressora sem ligação WebSocket aberta.
export class PrinterOfflineError extends Error {
  constructor(
    message = 'A impressora está desligada. Verifica se está ligada à corrente e à rede.'
  ) {
    super(message);
    this.name = 'PrinterOfflineError';
    Object.setPrototypeOf(this, PrinterOfflineError.prototype);
  }
}

// A impressora recusou o comando por estar ocupada.
export class PrinterBusyError extends Error {
  constructor(message = 'A impressora está ocupada a executar outra tarefa.') {
    super(message);
    this.name = 'PrinterBusyError';
    Object.setPrototypeOf(this, PrinterBusyError.prototype);
  }
}

// A impressora não respondeu dentro do tempo previsto.
export class PrinterTimeoutError extends Error {
  constructor(
    message = 'A impressora não respondeu a tempo. Tenta outra vez.'
  ) {
    super(message);
    this.name = 'PrinterTimeoutError';
    Object.setPrototypeOf(this, PrinterTimeoutError.prototype);
  }
}

// Traduz qualquer erro para uma frase curta em português, pronta a mostrar.
export const mensagemDeErro = (erro: unknown): string => {
  if (
    erro instanceof CommandValidationError ||
    erro instanceof PrinterOfflineError ||
    erro instanceof PrinterBusyError ||
    erro instanceof PrinterTimeoutError
  ) {
    return erro.message;
  }

  const texto =
    erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : '';
  const t = texto.toLowerCase();

  if (t.includes('timeout') || t.includes('esgotado')) {
    return 'O tempo esgotou-se à espera da impressora.';
  }
  if (
    t.includes('sem ligação') ||
    t.includes('ligação à impressora') ||
    t.includes('network') ||
    t.includes('rede') ||
    t.includes('connection')
  ) {
    return 'Não foi possível falar com a impressora. Verifica a rede.';
  }
  if (t.includes('não respondeu') || t.includes('sem resposta')) {
    return 'A impressora não respondeu ao comando.';
  }

  return texto ? `Algo falhou: ${texto}` : 'Ocorreu um erro inesperado.';
};

/**
 * Traduz o código Ack da impressora numa explicação em português.
 *
 * Só se afirmam os códigos observados na máquina: 0 = aceite, 1 = recusado,
 * 2 = recusado por "não encontrado" nos comandos testados. O resto fica
 * como código cru, sem inventar significado.
 */
export const descreverAck = (
  ack: number,
  comando: string
): { titulo: string; mensagem: string } => {
  const palavras: Record<number, string> = {
    1: `A impressora recusou "${comando}". Costuma ser o estado dela: por exemplo, retomar quando já não há impressão em pausa, ou parar quando já está parada. Confirma no ecrã da impressora.`,
    2: `A impressora respondeu a "${comando}" com "não encontrado" — normalmente significa que não há nenhuma tarefa nesse estado. Confirma no ecrã da impressora.`,
  };
  return {
    titulo: 'Comando recusado',
    mensagem:
      palavras[ack] ??
      `A impressora recusou "${comando}" com o código ${ack}. Se o estado ficar preso, corta a corrente na tomada e volta a ligar.`,
  };
};

// A impressora respondeu com Ack > 0: aceitou receber, recusou executar.
export class PrinterRecusouError extends Error {
  ack: number;
  comando: string;

  constructor(ack: number, comando: string) {
    const aviso = descreverAck(ack, comando);
    super(aviso.mensagem);
    this.name = 'PrinterRecusouError';
    this.ack = ack;
    this.comando = comando;
    Object.setPrototypeOf(this, PrinterRecusouError.prototype);
  }
}

/** Texto para mostrar ao utilizador, sem stack traces nem jargão. */
export const mensagemDoErro = (erro: unknown): string => {
  if (erro instanceof PrinterRecusouError) return erro.message;
  if (erro instanceof PrinterOfflineError) return erro.message;
  if (erro instanceof PrinterBusyError) return erro.message;
  if (erro instanceof PrinterTimeoutError) return erro.message;
  if (erro instanceof Error && erro.message) return erro.message;
  return 'Não foi possível completar o comando.';
};
