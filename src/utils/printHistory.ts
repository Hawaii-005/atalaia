import { log } from './log';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'printHistory';
const MAX_RECORDS = 60;

export type PrintOutcome = 'printing' | 'completed' | 'stopped' | 'unknown';

export interface PrintRecord {
  id: string;
  printerName: string;
  printerIp: string;
  filename: string;
  startedAt: number;
  endedAt?: number;
  layers?: number;
  totalLayers?: number;
  outcome: PrintOutcome;
}

export const loadHistory = async (): Promise<PrintRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    log('could not load print history', error);
    return [];
  }
};

const saveHistory = async (records: PrintRecord[]) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch (error) {
    log('could not save print history', error);
  }
};

export const startRecord = async (record: Omit<PrintRecord, 'id' | 'startedAt'>) => {
  const records = await loadHistory();
  const open = records.find(
    item => item.outcome === 'printing' && item.printerName === record.printerName
  );
  if (open && open.filename === record.filename) {
    return;
  }
  // Registo aberto com outro ficheiro é um trabalho cujo fim nunca foi visto
  // (app fechada, ligação caída). Fechava-se em «a imprimir» para sempre e,
  // pior, impedia o trabalho seguinte de ser registado. Fica «sem confirmação».
  const limpos = open
    ? records.map(item =>
        item === open
          ? { ...item, outcome: 'unknown' as PrintOutcome, endedAt: Date.now() }
          : item
      )
    : records;
  const entry: PrintRecord = {
    ...record,
    id: `${Date.now()}`,
    startedAt: Date.now(),
    outcome: 'printing',
  };
  await saveHistory([entry, ...limpos]);
};

export const finishRecord = async (
  printerName: string,
  outcome: Exclude<PrintOutcome, 'printing'>,
  layers?: number,
  /** Sem hora de fim conhecida: deixar `endedAt` vazio é mais honesto do que
   *  inventar uma duração (caso do trabalho cujo fim aconteceu com a app fechada). */
  semHoraDeFim = false
) => {
  const records = await loadHistory();
  const index = records.findIndex(
    item => item.outcome === 'printing' && item.printerName === printerName
  );
  if (index === -1) {
    return;
  }
  records[index] = {
    ...records[index],
    outcome,
    ...(semHoraDeFim ? { endedAt: undefined } : { endedAt: Date.now() }),
    layers: layers ?? records[index].layers,
  };
  await saveHistory(records);
};

export const clearHistory = async () => {
  await saveHistory([]);
};

export const formatDuration = (record: PrintRecord) => {
  if (!record.endedAt && record.outcome !== 'printing') {
    return '—';
  }
  const end = record.endedAt ?? Date.now();
  const seconds = Math.max(0, Math.round((end - record.startedAt) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};
