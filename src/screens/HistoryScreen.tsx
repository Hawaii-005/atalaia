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
import { t, idiomaActual } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

// Etiquetas visíveis para o desfecho de cada impressão (chaves i18n).
const outcomeLabel: Record<PrintRecord['outcome'], string> = {
  printing: 'history.aImprimir',
  completed: 'history.concluida',
  stopped: 'history.parada',
};

// Locale de formatação de datas segue o idioma detectado.
const LOCALE = idiomaActual === 'pt' ? 'pt-PT' : 'en-GB';

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
  });
};

const HistoryRow = ({ record }: { record: PrintRecord }) => {
  const { tema } = useTheme();
  const { preview } = useGcodePreview(record.printerIp, record.filename);
  const name = record.filename.split('/').pop() ?? record.filename;

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-line">
      <View className="w-14 h-14 rounded-lg bg-cartao border border-line items-center justify-center overflow-hidden">
        {preview ? (
          <Svg viewBox="0 0 100 100" width={52} height={52}>
            <Path d={preview.path} stroke={hexDe(tema.paleta.tinta)} strokeWidth={0.6} fill="none" />
          </Svg>
        ) : (
          <Ionicons name="cube-outline" size={18} color={hexDe(tema.paleta.tintaMuted)} />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
          {name}
        </Text>
        <Text className="text-[11px] text-ink-muted mt-1">
          {formatDate(record.startedAt)} · {formatDuration(record)} ·{' '}
          {t('comum.camadas', {
            n: record.layers ?? record.totalLayers ?? '—',
          })}
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
          {t(outcomeLabel[record.outcome])}
        </Text>
      </View>
    </View>
  );
};

export const HistoryScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const [records, setRecords] = useState<PrintRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setRecords);
    }, [])
  );

  const handleClear = () => {
    Alert.alert(
      t('history.limparTitulo'),
      t('history.limparMsg'),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('history.limpar'),
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            setRecords([]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('history.title')}
        subtitle={
          records.length === 1
            ? t('history.contagem_um', { n: records.length })
            : t('history.contagem_outros', { n: records.length })
        }
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
            <Ionicons name="time-outline" size={40} color={hexDe(tema.paleta.tintaMuted)} />
            <Text className="text-[15px] font-semibold text-ink mt-3">
              {t('history.semImpressoes')}
            </Text>
            <Text className="text-[12px] text-ink-muted mt-1 text-center px-8">
              {t('history.semImpressoesDica')}
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
            {t('history.miniaturasDica')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
