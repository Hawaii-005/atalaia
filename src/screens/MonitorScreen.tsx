import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { PrinterCard } from '../components/PrinterCard';
import { ResinJobCard } from '../components/ResinJobCard';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

/**
 * Aba Monitor: mostra todas as impressoras, uma por bloco, ligadas primeiro.
 * Cada bloco abre o ecrã próprio daquela máquina (Câmara ou Resina).
 * Sem chips de seleção — as máquinas distinguem-se pelo conteúdo.
 */
export const MonitorScreen = ({ navigation, route }: any) => {
  const { tema } = useTheme();
  const { printers } = usePrinterConnections();

  const ligadas = useMemo(
    () => printers.filter(p => p.connectionStatus === 'connected'),
    [printers]
  );

  // Mostram-se todas as máquinas; as ligadas primeiro. Esconder as que estão
  // offline deixava a aba vazia sem explicação quando a rede cai.
  const ordenadas = useMemo(
    () =>
      [...printers].sort((a, b) => {
        const pa = a.connectionStatus === 'connected' ? 0 : 1;
        const pb = b.connectionStatus === 'connected' ? 0 : 1;
        return pa - pb;
      }),
    [printers]
  );

  if (printers.length === 0) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-8">
        <Ionicons name="eye-off-outline" size={28} color={hexDe(tema.paleta.tintaSoft)} />
        <Text className="text-[13px] text-ink-muted mt-3 text-center">
          {t('monitor.semImpressoras')}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas" style={{ flex: 1 }}>
      {/* Cabeçalho */}
      <View className="px-4 pt-3 pb-2">
        <Text className="text-[22px] font-bold text-ink">{t('monitor.titulo')}</Text>
        <Text className="text-[12px] text-ink-soft mt-0.5">
          {t('monitor.subtitulo', { n: ligadas.length })}
        </Text>
      </View>

      {/* Lista de impressoras */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 80 }}
      >
        {ordenadas
          .filter(p => p.kind !== 'resin')
          .map(p => (
            <PrinterCard
              key={p.id}
              printer={p}
              showTemps
              onPress={() => navigation.navigate('Camera', { printerId: p.id })}
              onOpenCamera={() => navigation.navigate('Camera', { printerId: p.id })}
            />
          ))}
        {ordenadas
          .filter(p => p.kind === 'resin')
          .map(p => (
            <ResinJobCard
              key={p.id}
              printer={p}
              onAbrir={() => navigation.navigate('Resina', { printerId: p.id })}
            />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
};