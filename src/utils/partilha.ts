import { DeviceEventEmitter, NativeModules } from 'react-native';

/** Um ficheiro que chegou pelo «Partilhar» (ou «Abrir com») do Android. */
export type FicheiroPartilhado = { uri: string; nome: string };

export type TipoDeFicheiro = 'gcode' | 'modelo' | 'outro';

const EXTENSOES_GCODE = ['.gcode', '.goo'];
const EXTENSOES_MODELO = ['.stl', '.3mf', '.obj'];

/**
 * Limpa o nome que vem de outra app: tira o caminho, troca o que não serve
 * num nome de ficheiro e garante um mínimo. O nome é o que a impressora vai
 * mostrar na lista, por isso não pode ir com barras nem com quebras de linha.
 */
export const nomeLimpo = (nome: string): string => {
  const base = (nome ?? '').split(/[\\/]/).pop() ?? '';
  const limpo = base.replace(/[^\w.\- ()[\]]+/g, '_').trim();
  return limpo.length > 0 ? limpo.slice(0, 120) : 'partilhado.gcode';
};

/** O que fazer com o ficheiro: enviar (G-code), avisar (modelo) ou recusar. */
export const tipoDoFicheiro = (nome: string): TipoDeFicheiro => {
  const minusculas = (nome ?? '').toLowerCase();
  if (EXTENSOES_GCODE.some(e => minusculas.endsWith(e))) return 'gcode';
  if (EXTENSOES_MODELO.some(e => minusculas.endsWith(e))) return 'modelo';
  return 'outro';
};

/**
 * Ficheiros recebidos desde a última chamada. O lado nativo guarda-os numa
 * caixa: se o intent chegar antes de o JS arrancar, ninguém os perde.
 */
export const lerPartilha = async (): Promise<FicheiroPartilhado[]> => {
  const modulo = NativeModules.Partilha as
    | { consumir?: () => Promise<FicheiroPartilhado[]> }
    | undefined;
  if (!modulo?.consumir) return [];
  try {
    const lista = await modulo.consumir();
    if (!Array.isArray(lista)) return [];
    return lista
      .filter(item => typeof item?.uri === 'string')
      .map(item => ({ uri: item.uri, nome: nomeLimpo(String(item.nome)) }));
  } catch {
    return [];
  }
};

/** Avisa quando chega um ficheiro novo enquanto a app já está aberta. */
export const ouvirPartilha = (aoChegar: () => void): (() => void) => {
  const subscricao = DeviceEventEmitter.addListener(
    'atalaiaPartilha',
    aoChegar
  );
  return () => subscricao.remove();
};
