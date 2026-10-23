import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { ResinJobCard } from '../components/ResinJobCard';
import { t } from '../i18n';

/**
 * Trabalho das impressoras de resina. Existe porque estas máquinas não têm
 * câmara: no lugar do vídeo mostra-se o que elas realmente publicam.
 */
export const WorkScreen = ({ navigation, dentroDoMonitor }: any) => {
  const { printers } = usePrinterConnections();
  const resinas = printers.filter(p => p.kind === 'resin');

  return (
    <SafeAreaView
      edges={dentroDoMonitor ? [] : ['top']}
      className="flex-1 bg-canvas"
    >
      <View className="px-4 pt-3 pb-2">
        <Text className="text-[22px] font-bold text-ink">{t('monitor.trabalho')}</Text>
        <Text className="text-[12px] text-ink-soft mt-0.5">
          {t('monitor.trabalhoSub')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
        {resinas.length === 0 ? (
          <Text className="text-[13px] text-ink-muted mt-6 text-center px-4">
            {t('monitor.semResina')}
          </Text>
        ) : (
          resinas.map(impressora => (
            <ResinJobCard
              key={impressora.id}
              printer={impressora}
              onAbrir={() =>
                navigation.navigate('Resina', { printerId: impressora.id })
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
