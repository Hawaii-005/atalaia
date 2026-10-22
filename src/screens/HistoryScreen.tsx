import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Header } from '../components/Header';
import { useGcodePreview } from '../hooks/useGcodePreview';
import {
  PrintRecord,
  clearHistory,
  formatDuration,
  loadHistory,
} from '../utils/printHistory';

const outcomeLabel: Record<PrintRecord['outcome'], string> = {
  printing: 'A imprimir',
  completed: 'Concluída',
  stopped: 'Parada',
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
  });
};

const HistoryRow = ({ record }: { record: PrintRecord }) => {
  const { preview } = useGcodePreview(record.printerIp, record.filename);
  const name = record.filename.split('/').pop() ?? record.filename;

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-line">
      <View className="w-14 h-14 rounded-lg bg-white border border-line items-center justify-center overflow-hidden">
        {preview ? (
          <Svg viewBox="0 0 100 100" width={52} height={52}>
            <Path d={preview.path} stroke="#171A20" strokeWidth={0.6} fill="none" />
          </Svg>
        ) : (
          <Ionicons name="cube-outline" size={18} color="#9AA0A6" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
          {name}
        </Text>
        <Text className="text-[11px] text-ink-muted mt-1">
          {formatDate(record.startedAt)} · {formatDuration(record)} ·{' '}
          {record.layers ?? record.totalLayers ?? '—'} camadas
        </Text>
      </View>
      <View
        className={`px-2 py-1 rounded-md ${
          record.outcome === 'completed'
            ? 'bg-state-ok/10'
            : record.outcome === 'stopped'
              ? 'bg-state-danger/10'
              : 'bg-brand-soft'
        }`}
      >
        <Text
          className={`text-[10px] font-semibold ${
            record.outcome === 'completed'
              ? 'text-state-ok'
              : record.outcome === 'stopped'
                ? 'text-state-danger'
                : 'text-brand'
          }`}
        >
          {outcomeLabel[record.outcome]}
        </Text>
      </View>
    </View>
  );
};

export const HistoryScreen = ({ navigation }: any) => {
  const [records, setRecords] = useState<PrintRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setRecords);
    }, [])
  );

  const handleClear = () => {
    Alert.alert('Limpar histórico', 'Isto apaga o registo de todas as impressões.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setRecords([]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title="Histórico"
        subtitle={`${records.length} ${records.length === 1 ? 'impressão' : 'impressões'}`}
        onBack={() => navigation.goBack()}
        rightAction={
          records.length > 0
            ? { icon: 'trash-outline', onPress: handleClear }
            : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {records.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Ionicons name="time-outline" size={40} color="#9AA0A6" />
            <Text className="text-[15px] font-semibold text-ink mt-3">
              Ainda sem impressões
            </Text>
            <Text className="text-[12px] text-ink-muted mt-1 text-center px-8">
              As impressões aparecem aqui quando começarem.
            </Text>
          </View>
        ) : (
          <View className="bg-canvas-sunken rounded-xl overflow-hidden">
            {records.map(record => (
              <HistoryRow key={record.id} record={record} />
            ))}
          </View>
        )}

        {records.length > 0 && (
          <Text className="text-[11px] text-ink-muted mt-3 px-1">
            As miniaturas são desenhadas a partir do G-code guardado na impressora.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
