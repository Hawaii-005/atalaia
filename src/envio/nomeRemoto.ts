/**
 * Nome do ficheiro no Moonraker. O carimbo evita que dois fatiamentos do mesmo
 * modelo se sobreponham e deixa rasto de quando foi gerado. Tudo o que sai
 * daqui já é um caminho dentro de `gcodes/` e nunca sai de lá.
 */

const PERMITIDO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_NOME = 120;

export const validarNome = (nome: string): boolean =>
  nome.length <= MAX_NOME &&
  nome.endsWith('.gcode') &&
  PERMITIDO.test(nome) &&
  !nome.includes('..');

/** `20261122-061008`, em UTC — igual em qualquer fuso. */
export const carimbo = (agora: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${agora.getUTCFullYear()}${p(agora.getUTCMonth() + 1)}${p(agora.getUTCDate())}` +
    `-${p(agora.getUTCHours())}${p(agora.getUTCMinutes())}${p(agora.getUTCSeconds())}`
  );
};

/** `cubo 25.6.stl` → `cubo-25.6-20261122-061008.gcode`. */
export const nomeComCarimbo = (base: string, agora: Date): string => {
  const limpo = base
    .replace(/\.(gcode|3mf|stl)$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  const nome = `${limpo || 'modelo'}-${carimbo(agora)}.gcode`;
  if (!validarNome(nome)) throw new Error('nome_invalido');
  return nome;
};

/** Caminho que o Moonraker usa (`gcodes/<nome>`), validado. */
export const caminhoRemoto = (nome: string): string => {
  if (!validarNome(nome)) throw new Error('nome_invalido');
  return `gcodes/${nome}`;
};
