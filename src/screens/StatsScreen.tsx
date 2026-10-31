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
import { Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { PrintRecord, loadHistory } from '../utils/printHistory';
import {
  historyVideoCommand,
  printHistoryCommand,
  printHistoryDetailCommand,
} from '../utils/commands';
import { mensagemDeErro } from '../utils/errors';
import { t } from '../i18n';
import { enderecoDe } from '../utils/rede';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

interface TaskDetail {
  TaskId: string;
  TaskName: string;
  BeginTime: number;
  EndTime: number;
  TaskStatus: number;
  AlreadyPrintLayer?: number;
  Thumbnail?: string;
  SliceInformation?: { print_time?: number; total_layer_numbers?: number };
  TimeLapseVideoUrl?: string;
  TimeLapseVideoStatus?: number;
}

// Etiquetas visíveis para o estado de cada tarefa (chaves i18n).
const STATUS_LABEL: Record<number, string> = {
  0: 'stats.statusOutro',
  1: 'stats.statusConcluida',
  2: 'stats.statusErro',
  3: 'stats.statusParada',
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
    {hint ? (
      <Text className="text-[11px] text-ink-muted mt-0.5">{hint}</Text>
    ) : null}
  </View>
);

export const StatsScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
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
      const idsPayload = await request(printer.id, printHistoryCommand());
      const ids: string[] = idsPayload?.HistoryData ?? [];
      if (ids.length === 0) {
        setTasks([]);
      } else {
        const detail = await request(
          printer.id,
          printHistoryDetailCommand(ids.slice(0, 80))
        );
        setTasks(detail?.HistoryDetailList ?? []);
      }
    } catch (e) {
      setError(mensagemDeErro(e));
    } finally {
      setLoading(false);
    }
    // Depender só do id: o objeto `printer` muda a cada actualização de
    // estado (30 s) e isso recarregava a página inteira.
  }, [printer?.id, request]);

  const [videoAberto, setVideoAberto] = useState<string | null>(null);

  const abrirVideo = async (url: string) => {
    if (!printer) return;
    setVideoAberto(url);
    try {
      const resposta = await request(
        printer.id,
        historyVideoCommand(url, { id: printer.id })
      );
      // A placa tanto devolve uma lista como um objecto com Url.
      const corpo: any =
        (resposta as any)?.Data?.Data ?? (resposta as any)?.Data ?? resposta;
      const lista = Array.isArray(corpo) ? corpo : [];
      let alvo: string | null =
        typeof corpo === 'string'
          ? corpo
          : typeof corpo?.Url === 'string'
            ? corpo.Url
            : ((lista.find((x: any) => typeof x === 'string') as
                | string
                | undefined) ??
              lista.find((x: any) => typeof x?.Url === 'string')?.Url ??
              null);

      if (!alvo) {
        Alert.alert(t('stats.video'), t('stats.videoIndisponivel'));
        return;
      }
      // Caminho relativo: o vídeo é servido pela própria impressora.
      if (!/^https?:/i.test(alvo)) {
        alvo = `http://${enderecoDe(printer)}/${String(alvo).replace(/^\/+/, '')}`;
      }
      await Linking.openURL(alvo);
    } catch (e) {
      Alert.alert(t('comum.erro'), mensagemDeErro(e));
    } finally {
      setVideoAberto(null);
    }
  };
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
  const totalLayers = tasks.reduce(
    (sum, t) => sum + (t.AlreadyPrintLayer ?? 0),
    0
  );

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
        title={t('stats.title')}
        subtitle={printer ? printer.printerName : t('comum.semImpressora')}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'refresh', onPress: load }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={hexDe(tema.paleta.acento)} />
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
            {t('stats.naImpressora')}
          </Text>
          <View className="flex-row mb-2">
            <StatCard
              label={t('stats.trabalhos')}
              value={String(tasks.length)}
              hint={t('stats.noHistorico')}
            />
            <View className="w-2" />
            <StatCard
              label={t('stats.concluidos')}
              value={String(completed)}
              hint={t('stats.parados', { n: stopped })}
            />
          </View>
          <View className="flex-row mb-5">
            <StatCard
              label={t('stats.tempo')}
              value={hours(totalSeconds)}
              hint={t('stats.impressaoSomada')}
            />
            <View className="w-2" />
            <StatCard
              label={t('stats.camadas')}
              value={String(totalLayers)}
              hint={t('stats.impressas')}
            />
          </View>

          <Text className="text-[11px] font-semibold tracking-widest text-ink-muted mb-2">
            {t('stats.porMes')}
          </Text>
          <View className="rounded-xl border border-line p-3 mb-5">
            {months.length === 0 ? (
              <Text className="text-[12px] text-ink-muted">
                {t('stats.semRegistos')}
              </Text>
            ) : (
              months.map(month => (
                <View key={month} className="flex-row items-center mb-2">
                  <Text className="text-[11px] text-ink-muted w-16">
                    {month}
                  </Text>
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
            {t('stats.ultimosTrabalhos')}
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
                  <Ionicons
                    name="cube-outline"
                    size={16}
                    color={hexDe(tema.paleta.tintaMuted)}
                  />
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text
                  className="text-[12px] font-semibold text-ink"
                  numberOfLines={1}
                >
                  {(task.TaskName ?? '').split('/').pop()}
                </Text>
                <Text className="text-[11px] text-ink-muted">
                  {t(STATUS_LABEL[task.TaskStatus] ?? 'stats.statusOutro')} ·{' '}
                  {hours(
                    task.SliceInformation?.print_time ??
                      Math.max(0, (task.EndTime ?? 0) - (task.BeginTime ?? 0))
                  )}
                </Text>
              </View>
              {task.TimeLapseVideoUrl ? (
                <TouchableOpacity
                  onPress={() => abrirVideo(task.TimeLapseVideoUrl!)}
                  className="ml-2 p-1"
                  disabled={videoAberto !== null}
                >
                  {videoAberto === task.TimeLapseVideoUrl ? (
                    <ActivityIndicator
                      size="small"
                      color={hexDe(tema.paleta.acento)}
                    />
                  ) : (
                    <Ionicons
                      name="play-circle-outline"
                      size={22}
                      color={hexDe(tema.paleta.acento)}
                    />
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ))}

          <TouchableOpacity
            onPress={() => navigation.navigate('History')}
            className="mt-4 py-3 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-[13px] font-semibold text-brand-texto">
              {t('stats.verHistoricoCompleto')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
