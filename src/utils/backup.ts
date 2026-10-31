/**
 * Cópia de segurança em JSON.
 *
 * A versão 1 só levava impressoras e preferências; a versão 2 acrescenta o
 * inventário de filamento. O import aceita as duas: um backup antigo entra
 * sem erro e simplesmente não traz inventário.
 */
import {
  EstadoFilamentos,
  migrarEstado,
  VERSAO_ESQUEMA,
} from './filamentos/armazenamento';

export const VERSAO_BACKUP = 2;

export interface BackupImpressora {
  printerName: string;
  ipAddress: string;
  alternateIp?: string;
  mainboardId?: string;
}

export interface BackupFilamentos {
  bobinas: unknown[];
  garrafas: unknown[];
  pendentes: unknown[];
  perfis: unknown[];
  usos: unknown[];
}

export interface Backup {
  versao: number;
  criadoEm: string;
  impressoras: BackupImpressora[];
  preferencias: Record<string, unknown>;
  filamentos?: BackupFilamentos;
}

export const montarBackup = (dados: {
  impressoras: BackupImpressora[];
  preferencias: Record<string, unknown>;
  filamentos?: EstadoFilamentos;
  criadoEm?: string;
}): Backup => ({
  versao: VERSAO_BACKUP,
  criadoEm: dados.criadoEm ?? new Date().toISOString(),
  impressoras: dados.impressoras,
  preferencias: dados.preferencias,
  ...(dados.filamentos
    ? {
        filamentos: {
          bobinas: dados.filamentos.bobinas,
          garrafas: dados.filamentos.garrafas,
          pendentes: dados.filamentos.pendentes,
          perfis: dados.filamentos.perfis,
          usos: dados.filamentos.usos,
        },
      }
    : {}),
});

/**
 * Lê um backup de qualquer versão. Lança só quando o texto não é JSON ou não
 * tem a lista de impressoras — é o mínimo que distingue "backup" de "ficheiro
 * errado".
 */
export const lerBackup = (texto: string): Backup => {
  const bruto = JSON.parse(texto) as Record<string, unknown>;
  if (!Array.isArray(bruto?.impressoras)) {
    throw new Error('backup sem lista de impressoras');
  }
  return {
    versao: typeof bruto.versao === 'number' ? bruto.versao : 1,
    criadoEm:
      typeof bruto.criadoEm === 'string'
        ? bruto.criadoEm
        : new Date(0).toISOString(),
    impressoras: (bruto.impressoras as unknown[])
      .map((item): BackupImpressora | null => {
        const p = item as Record<string, unknown>;
        if (typeof p?.printerName !== 'string') return null;
        if (typeof p?.ipAddress !== 'string') return null;
        return {
          printerName: p.printerName,
          ipAddress: p.ipAddress,
          alternateIp:
            typeof p.alternateIp === 'string' ? p.alternateIp : undefined,
          mainboardId:
            typeof p.mainboardId === 'string' ? p.mainboardId : undefined,
        };
      })
      .filter((item): item is BackupImpressora => item !== null),
    preferencias:
      bruto.preferencias && typeof bruto.preferencias === 'object'
        ? (bruto.preferencias as Record<string, unknown>)
        : {},
    ...(bruto.filamentos && typeof bruto.filamentos === 'object'
      ? {
          filamentos: {
            bobinas: Array.isArray((bruto.filamentos as any).bobinas)
              ? (bruto.filamentos as any).bobinas
              : [],
            garrafas: Array.isArray((bruto.filamentos as any).garrafas)
              ? (bruto.filamentos as any).garrafas
              : [],
            pendentes: Array.isArray((bruto.filamentos as any).pendentes)
              ? (bruto.filamentos as any).pendentes
              : [],
            perfis: Array.isArray((bruto.filamentos as any).perfis)
              ? (bruto.filamentos as any).perfis
              : [],
            usos: Array.isArray((bruto.filamentos as any).usos)
              ? (bruto.filamentos as any).usos
              : [],
          },
        }
      : {}),
  };
};

const unirPor = <T>(
  actuais: T[],
  importados: T[],
  chave: (item: T) => string
): { lista: T[]; novos: number } => {
  const mapa = new Map<string, T>();
  actuais.forEach(item => mapa.set(chave(item), item));
  let novos = 0;
  importados.forEach(item => {
    const k = chave(item);
    if (!mapa.has(k)) novos += 1;
    mapa.set(k, item);
  });
  return { lista: Array.from(mapa.values()), novos };
};

/**
 * Junta o inventário do backup ao que já existe. Ganha o backup em caso de
 * conflito de id (é um restauro), e conta quantas bobinas entraram de novo.
 */
export const importarFilamentos = (
  actual: EstadoFilamentos,
  backup: Backup
): { estado: EstadoFilamentos; bobinasNovas: number } => {
  if (!backup.filamentos) return { estado: actual, bobinasNovas: 0 };

  const importado = migrarEstado({
    ...backup.filamentos,
    versao: VERSAO_ESQUEMA,
  });
  const bobinas = unirPor(actual.bobinas, importado.bobinas, b => b.id);
  const garrafas = unirPor(actual.garrafas, importado.garrafas, g => g.id);
  const pendentes = unirPor(actual.pendentes, importado.pendentes, p => p.id);
  const perfis = unirPor(actual.perfis, importado.perfis, p => p.material);
  const usos = unirPor(actual.usos, importado.usos, u => u.id);

  return {
    estado: {
      versao: VERSAO_ESQUEMA,
      bobinas: bobinas.lista,
      garrafas: garrafas.lista,
      pendentes: pendentes.lista,
      perfis: perfis.lista,
      usos: usos.lista,
    },
    bobinasNovas: bobinas.novos,
  };
};
