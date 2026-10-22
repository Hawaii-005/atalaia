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
