import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { RelogioBancada } from '../components/RelogioBancada';
import { TrabalhoRelogio } from '../utils/relogio';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';
import { getPrintStatus } from '../types';

export const BancadaScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers } = usePrinterConnections();

  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const trabalhos = useMemo<TrabalhoRelogio[]>(() => {
    const ts: TrabalhoRelogio[] = [];
    for (const printer of printers) {
      const info = printer.status?.PrintInfo;
      if (!info || !info.Filename) continue;
      
      const estado = getPrintStatus(info.Status ?? 0);
      const isActive = estado === 'printing' || estado === 'paused' || estado === 'preparing';
      if (!isActive) continue;

      const inicioTempo = agora.getTime() - (info.CurrentTicks * 1000);
      const fimTempo = agora.getTime() + ((info.TotalTicks - info.CurrentTicks) * 1000);

      const dInicio = new Date(inicioTempo);
      const dFim = new Date(fimTempo);

      const decInicio = dInicio.getHours() + dInicio.getMinutes() / 60;
      const decFim = dFim.getHours() + dFim.getMinutes() / 60;

      ts.push({
        id: printer.id,
        nome: printer.printerName,
        inicio: decInicio,
        fim: decFim,
        cor: printer.kind === 'resin' ? hexDe(paleta.ok) : hexDe(paleta.acento),
      });
    }
    return ts;
  }, [printers, agora, paleta]);

  const ordenadas = useMemo(() => {
    return [...printers].sort((a, b) => {
      const pa = a.connectionStatus === 'connected' ? 0 : 1;
      const pb = b.connectionStatus === 'connected' ? 0 : 1;
      return pa - pb;
    });
  }, [printers]);

  const subtituloData = agora.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' });

  const aoTocar = (printerId: string) => {
    const p = printers.find(x => x.id === printerId);
    if (p) {
      if (p.kind === 'resin') {
        navigation.navigate('Resina', { printerId });
      } else {
        navigation.navigate('PrinterDetails', { printerId });
      }
    }
  };

  return (
    <SafeAreaView edges={['top']} className="bg-canvas" style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
      >
        <View className="mb-6">
          <Text className="text-[22px] font-bold text-ink">
            {t('bancada.titulo')}
          </Text>
          <Text className="text-[14px] text-ink-soft mt-1 capitalize">
            {subtituloData}
          </Text>
        </View>

        <View className="items-center mb-8">
          {trabalhos.length > 0 ? (
            <RelogioBancada
              agora={agora}
              trabalhos={trabalhos}
              aoTocar={aoTocar}
            />
          ) : (
            <View className="items-center justify-center h-[340px]">
              <Text className="text-[16px] text-ink-muted">
                {t('bancada.semTrabalho')}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[14px] font-bold text-ink-soft uppercase tracking-wider">
            {t('home.title')}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('MonitorLista')}>
            <Text className="text-[14px] font-semibold text-brand">
              {t('bancada.verLista')}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="space-y-3">
          {ordenadas.map(p => {
            const info = p.status?.PrintInfo;
            const estadoActual = getPrintStatus(info?.Status ?? 0);
            const isPrinting =
              !!info?.Filename &&
              (estadoActual === 'printing' || estadoActual === 'paused' || estadoActual === 'preparing');
            
            let estadoTexto = p.connectionStatus === 'connected' ? t('comum.ligada') : t('comum.desligada');
            if (p.connectionStatus === 'connected' && info?.Filename) {
              const statusKey = getPrintStatus(info.Status ?? 0);
              // Simplified translation lookup based on status:
              if (statusKey === 'printing') estadoTexto = t('comum.aImprimir');
              else if (statusKey === 'preparing') estadoTexto = t('comum.aPreparar');
              else if (statusKey === 'paused') estadoTexto = t('comum.emPausa');
              else if (statusKey === 'stopped') estadoTexto = t('comum.parada');
              else if (statusKey === 'completed') estadoTexto = t('comum.impressaoConcluida');
              else estadoTexto = t('resina.emRepouso');
            }

            let horaFim = '';
            if (isPrinting && info) {
              const fimTempo = agora.getTime() + ((info.TotalTicks - info.CurrentTicks) * 1000);
              const dFim = new Date(fimTempo);
              horaFim = dFim.getHours().toString().padStart(2, '0') + ':' + dFim.getMinutes().toString().padStart(2, '0');
            }

            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.7}
                onPress={() => aoTocar(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`${p.printerName}, ${estadoTexto}`}
                className="bg-card rounded-2xl p-4 border border-line flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-[16px] font-semibold text-ink" numberOfLines={1}>
                    {p.printerName}
                  </Text>
                  <Text className="text-[13px] text-ink-muted mt-1">
                    {estadoTexto}
                  </Text>
                </View>
                
                {isPrinting && info ? (
                  <View className="items-end ml-4">
                    <Text className="text-[16px] font-semibold text-ink">
                      {info.Progress}%
                    </Text>
                    {info.TotalLayer > 0 && (
                      <Text className="text-[12px] text-ink-soft mt-1">
                        {t('bancada.camada', { x: info.CurrentLayer, y: info.TotalLayer })}
                      </Text>
                    )}
                    <Text className="text-[12px] text-ink-soft mt-0.5">
                      {t('bancada.fim')} {horaFim}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};