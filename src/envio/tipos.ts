/**
 * Tipos do envio para Moonraker (COSMOS). Nada aqui fala com a rede, com o
 * React ou com o módulo nativo do fatiador — a variante lite (MIT) importa
 * estes ficheiros com G-code vindo de outras fontes.
 */

/** Fases do caminho feliz. Os erros não são fases: ver `ErroEnvio`. */
export type Fase =
  | 'pronto'
  | 'aEnviar'
  | 'enviado'
  | 'aVerificar'
  | 'verificado'
  | 'aArrancar'
  | 'iniciado';

export type ErroEnvio =
  | 'ocupada'
  | 'autenticacao'
  | 'semEspaco'
  | 'timeout'
  | 'inconsistente'
  | 'arranqueFalhou'
  | 'cancelado';

/** O que o utilizador pode fazer a seguir. */
export type Saida = 'repetir' | 'fila' | 'credenciais' | 'resultado';

export type Estado =
  | { fase: 'pronto' }
  | { fase: 'aEnviar'; enviado: number; total: number }
  | { fase: 'enviado'; remoto: string }
  | {
      fase: 'aVerificar';
      remoto: string;
      /** 1 na primeira leitura; cresce a cada 404 temporário. */
      tentativa: number;
      desde: number;
    }
  | { fase: 'verificado'; remoto: string }
  | { fase: 'aArrancar'; remoto: string }
  | { fase: 'iniciado'; remoto: string }
  | {
      fase: 'falhou';
      erro: ErroEnvio;
      /** Fase de onde se falhou: decide o que fazer com o ficheiro remoto. */
      de: Exclude<Fase, 'iniciado'>;
      remoto?: string;
    };
