import { PreferenciaIdioma } from '../../i18n';
import { TemaId } from '../../theme/temas';
import { Printer } from '../../types';
import { NotificationPrefs } from '../../utils/notifications';

/**
 * Tudo o que as secções das Definições precisam de ler ou de disparar.
 * Vive no ecrã principal para não haver dois sítios a guardar o mesmo valor.
 */
export interface ContextoDefinicoes {
  versao: string;

  // Impressoras
  printers: Printer[];
  navegar: (rota: string, params?: Record<string, unknown>) => void;
  abrirUrl: (url: string) => void;

  // Aparência
  temaId: TemaId;
  definirTema: (id: TemaId) => void;
  intervaloMs: number;
  definirIntervalo: (ms: number) => void;
  preferenciaIdioma: PreferenciaIdioma;
  abrirIdiomas: () => void;

  // Fila e impressão
  filaAuto: boolean;
  definirFilaAuto: (v: boolean) => void;
  filaTamanho: number;
  modoRemoto: boolean;
  definirModoRemoto: (v: boolean) => void;
  notificacoes: NotificationPrefs;
  definirNotificacao: (chave: keyof NotificationPrefs, v: boolean) => void;
  testarNotificacao: () => void;

  // Filamentos
  limite: number;
  guardarLimite: (valor: number) => void;
  precoKwh: number;
  guardarPrecoKwh: (valor: number) => void;
  potenciaW: number;
  guardarPotenciaW: (valor: number) => void;

  // Segurança e dados
  exportar: () => void;
  importar: () => void;
  exportarDiagnostico: () => void;
  timelapseExperimental: boolean;
  definirTimelapse: (v: boolean) => void;
  reiniciarBoasVindas: () => void;
}

export interface PropsSecao {
  ctx: ContextoDefinicoes;
  /** Diz se uma opção passa o filtro da pesquisa. */
  visivel: (id: string) => boolean;
}
