/**
 * Log de desenvolvimento. Na versão final (release) não escreve nada — os
 * `console.log` de diagnóstico não devem correr, nem gastar, em produção.
 */
export const log = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args);
  }
};
