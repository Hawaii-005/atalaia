/** Tipos e formatadores partilhados pelo ecrã de Ficheiros. */

export interface PrinterFile {
  name: string;
  FileSize?: number;
  usedSize?: number;
  totalSize?: number;
  CreateTime?: number;
  TotalLayers?: number;
}

export const PREVIEW_LIMIT = 15 * 1024 * 1024;

// O Cmd 260 é rápido, mas repetir o pedido a cada abertura do painel nota-se.
export const cacheDetalhe = new Map<string, any>();

export const formatTempo = (seg?: number) => {
  if (!seg || seg <= 0) return '';
  const h = Math.floor(seg / 3600);
  const m = Math.round((seg % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

export const formatSize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};
