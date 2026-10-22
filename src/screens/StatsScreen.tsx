import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { PrintRecord, loadHistory } from '../utils/printHistory';

interface TaskDetail {
  TaskId: string;
  TaskName: string;
  BeginTime: number;
  EndTime: number;
  TaskStatus: number;
  AlreadyPrintLayer?: number;
  Thumbnail?: string;
  SliceInformation?: { print_time?: number; total_layer_numbers?: number };
}

const STATUS_LABEL: Record<number, string> = {
  0: 'Outro',
  1: 'Concluída',
  2: 'Erro',
  3: 'Parada',
};

const hours = (seconds: number) => `${Math.round(seconds / 360) / 10}h`;

const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <View className="flex-1 rounded-xl border border-line p-3">
    <Text className="text-[10px] font-semibold tracking-widest text-ink-muted">
      {label}
    </Text>
    <Text className="text-[20px] font-bold text-ink mt-1">{value}</Text>
    {hint ? <Text className="text-[11px] text-ink-muted mt-0.5">{hint}</Text> : null}
  </View>
);

export const StatsScreen = ({ navigation }: any) => {
  const { printers, request } = usePrinterConnections();
  const printer = printers[0];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [local, setLocal] = useState<PrintRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const localRecords = await loadHistory();
    setLocal(localRecords);
    if (!printer) {
      setLoading(false);
      return;
    }
    try {
      const idsPayload = await request(printer.id, 320, {});
      const ids: string[] = idsPayload?.HistoryData ?? [];
      if (ids.length === 0) {
        setTasks([]);
      } else {
        const detail = await request(printer.id, 321, { Id: ids.slice(0, 80) });
        setTasks(detail?.HistoryDetailList ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [printer, request]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const completed = tasks.filter(t => t.TaskStatus === 1).length;
  const stopped = tasks.filter(t => t.TaskStatus === 3).length;
  const totalSeconds = tasks.reduce((sum, task) => {
    const planned = task.SliceInformation?.print_time ?? 0;
    const actual = Math.max(0, (task.EndTime ?? 0) - (task.BeginTime ?? 0));
    return sum + (planned || actual);
  }, 0);
  const totalLayers = tasks.reduce((sum, t) => sum + (t.AlreadyPrintLayer ?? 0), 0);

  const byMonth = local.reduce<Record<string, number>>((acc, record) => {
    const date = new Date(record.startedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const months = Object.keys(byMonth).sort().slice(-6);
  const maxMonth = Math.max(1, ...months.map(m => byMonth[m]));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title="Estatísticas"
        subtitle={printer ? printer.printerName : 'Sem impressora'}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'refresh', onPress: load }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3E6AE1" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View className="rounded-xl border border-line p-3 mb-4">
              <Text className="text-[12px] text-ink-muted">{error}</Text>
            </View>
          ) : null}

          <Text className="text-[11px] font-semibold tracking-widest text-ink-muted mb-2">
            NA IMPRESSORA
          </Text>
          <View className="flex-row mb-2">
            <StatCard label="TRABALHOS" value={String(tasks.length)} hint="no histórico" />
            <View className="w-2" />
            <StatCard
              label="CONCLUÍDOS"
              value={String(completed)}
              hint={`${stopped} parados`}
            />
          </View>
          <View className="flex-row mb-5">
            <StatCard label="TEMPO" value={hours(totalSeconds)} hint="impressão somada" />
            <View className="w-2" />
            <StatCard label="CAMADAS" value={String(totalLayers)} hint="impressas" />
          </View>

          <Text className="text-[11px] font-semibold tracking-widest text-ink-muted mb-2">
            POR MÊS (registos desta app)
          </Text>
          <View className="rounded-xl border border-line p-3 mb-5">
            {months.length === 0 ? (
              <Text className="text-[12px] text-ink-muted">
                Ainda sem impressões registadas nesta app.
              </Text>
            ) : (
              months.map(month => (
                <View key={month} className="flex-row items-center mb-2">
                  <Text className="text-[11px] text-ink-muted w-16">{month}</Text>
                  <View className="flex-1 h-2 rounded-full bg-canvas-sunken overflow-hidden">
                    <View
                      className="h-full bg-brand"
                      style={{ width: `${(byMonth[month] / maxMonth) * 100}%` }}
                    />
                  </View>
                  <Text className="text-[11px] font-semibold text-ink w-8 text-right">
                    {byMonth[month]}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text className="text-[11px] font-semibold tracking-widest text-ink-muted mb-2">
            ÚLTIMOS TRABALHOS
          </Text>
          {tasks.slice(0, 8).map(task => (
            <View
              key={task.TaskId}
              className="flex-row items-center py-2 border-b border-line"
            >
              {task.Thumbnail ? (
                <Image
                  source={{ uri: task.Thumbnail }}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                />
              ) : (
                <View className="w-10 h-10 rounded-lg bg-canvas-sunken items-center justify-center">
                  <Ionicons name="cube-outline" size={16} color="#9AA0A6" />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-[12px] font-semibold text-ink" numberOfLines={1}>
                  {(task.TaskName ?? '').split('/').pop()}
                </Text>
                <Text className="text-[11px] text-ink-muted">
                  {STATUS_LABEL[task.TaskStatus] ?? 'Outro'} ·{' '}
                  {hours(
                    task.SliceInformation?.print_time ??
                      Math.max(0, (task.EndTime ?? 0) - (task.BeginTime ?? 0))
                  )}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={() => navigation.navigate('History')}
            className="mt-4 py-3 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-[13px] font-semibold text-brand">
              Ver histórico completo
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
