import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { PrinterCard } from '../components/PrinterCard';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { Ionicons } from '@expo/vector-icons';
import { checkLocalNetworkAccess } from '@generac/react-native-local-network-permission';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { BT_ACENTO, BT_APAGADA, BT_NEUTRA, BT_PERIGO, TX_ACENTO, TX_PERIGO } from '../theme/botoes';

export const HomeScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [hasNetworkAccess, setHasNetworkAccess] = useState(true);
  const { printers, reconnectAll, removePrinter, sendCommand } =
    usePrinterConnections();

  const checkNetworkAccess = async () => {
    const hasAccess = await checkLocalNetworkAccess();
    setHasNetworkAccess(hasAccess);
  };

  useEffect(() => {
    checkNetworkAccess();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reconnectAll();
    checkNetworkAccess();
    setTimeout(() => setRefreshing(false), 1000);
  }, [reconnectAll]);

  const handlePrinterPress = (printerId: string) => {
    const printer = printers.find(p => p.id === printerId);
    if (printer?.connectionStatus === 'connected') {
      navigation.navigate('PrinterDetails', { printerId });
      return;
    }
    // Enquanto a reconexão automática está a correr, não se sugere apagar a
    // impressora: dá-se a tentativa em curso e um botão para forçar já.
    if (printer?.reconnectAttempt) {
      Alert.alert(
        t('comum.aReconectar'),
        t('home.aReconectarMsg', {
          nome: printer.printerName,
          n: printer.reconnectAttempt,
        }),
        [
          { text: t('comum.fechar'), style: 'cancel' },
          { text: t('home.tentarAgora'), onPress: () => reconnectAll() },
        ]
      );
      return;
    }
    Alert.alert(
      t('comum.impressoraDesligada'),
      t('home.naoLigadaMsg', { nome: printer?.printerName ?? '' }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('home.eliminarImpressora'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('home.eliminarImpressora'),
              t('home.removerIrreversivel', { nome: printer?.printerName ?? '' }),
              [
                { text: t('comum.cancelar'), style: 'cancel' },
                {
                  text: t('home.eliminar'),
                  style: 'destructive',
                  onPress: () => printer && removePrinter(printer.id),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePrintControl = (printerId: string, status: number) => {
    const cmd = status === 6 ? 131 : 129;
    sendCommand(printerId, {
      Id: '',
      Data: {
        Cmd: cmd,
        Data: {},
        RequestID: `${cmd === 131 ? 'resume' : 'pause'}-${Date.now()}`,
        MainboardID: '',
        TimeStamp: Date.now(),
        From: 1,
      },
    });
  };

  const handleStopPrint = (printerId: string, name: string) => {
    Alert.alert(t('comum.cancelarImpressao'), t('home.pararImpressaoEm', { nome: name }), [
      { text: t('comum.continuarImpressao'), style: 'cancel' },
      {
        text: t('comum.pararImpressao'),
        style: 'destructive',
        onPress: () =>
          sendCommand(printerId, {
            Id: '',
            Data: {
              Cmd: 130,
              Data: {},
              RequestID: `cancel-${Date.now()}`,
              MainboardID: '',
              TimeStamp: Date.now(),
              From: 1,
            },
          }),
      },
    ]);
  };

  // Impressora em trabalho: alimenta o bloco grande do topo (conceito B)
  const emTrabalho = printers.find(pr => {
    const st = pr.status?.PrintInfo?.Status ?? 0;
    // 6 e 13 = a imprimir; 8 = parada (o Progress fica com o valor antigo).
    return st === 6 || st === 13;
  });
  const heroInfo = emTrabalho?.status?.PrintInfo;
  const heroProgresso = Math.max(0, Math.min(100, heroInfo?.Progress ?? 0));
  const heroRestanteSeg = Math.max(
    0,
    Math.round((heroInfo?.TotalTicks ?? 0) - (heroInfo?.CurrentTicks ?? 0))
  );
  const heroRestante =
    heroRestanteSeg >= 3600
      ? `${Math.floor(heroRestanteSeg / 3600)}h ${Math.round((heroRestanteSeg % 3600) / 60)}m`
      : `${Math.round(heroRestanteSeg / 60)}m`;
  const heroVent = emTrabalho?.status?.CurrentFanSpeed;

  const onlineCount = printers.filter(
    p => p.connectionStatus === 'connected'
  ).length;

  const subtitle =
    printers.length === 0
      ? t('home.semImpressoras')
      : `${printers.length === 1
          ? t('home.contadorImpressoras_um', { n: printers.length })
          : t('home.contadorImpressoras_outros', { n: printers.length })} · ${
          onlineCount === 1
            ? t('home.contadorLigadas_um', { n: onlineCount })
            : t('home.contadorLigadas_outros', { n: onlineCount })
        }`;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('home.title')}
        subtitle={subtitle}
        rightAction={{
          icon: 'wifi',
          onPress: () => navigation.navigate('Discovery'),
        }}
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={hexDe(tema.paleta.acento)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {printers.length > 0 && !hasNetworkAccess && (
          <TouchableOpacity
            className="mb-4 rounded-xl2 bg-state-light/10 border border-state-light/40 p-4 flex-row"
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="warning-outline" size={18} color={hexDe(tema.paleta.aviso)} />
            <Text className="ml-2 flex-1 text-[13px] leading-[19px] text-[#6B4E00]">
              {t('home.avisoRedeLocal')}
            </Text>
          </TouchableOpacity>
        )}

        {emTrabalho && (
          <View className="mb-5">
            <View className="flex-row items-end justify-between">
              <Text
                className="text-[54px] leading-[58px] font-bold text-ink"
                style={{ fontFamily: 'monospace' }}
              >
                {heroProgresso}
                <Text className="text-[18px] text-ink-muted"> %</Text>
              </Text>
              <View className="items-end pb-2 flex-1 pl-4">
                <Text className="text-[11px] text-ink-soft" numberOfLines={1}>
                  {String(heroInfo?.Filename ?? '').split('/').pop()}
                </Text>
                <Text className="text-[11px] text-ink-muted mt-0.5">
                  {t('comum.camada', {
                    actual: heroInfo?.CurrentLayer ?? 0,
                    total: heroInfo?.TotalLayer ?? 0,
                  })}
                  {' · '}
                  {t('camera.faltam', { tempo: heroRestante })}
                </Text>
              </View>
            </View>

            <View className="h-1.5 rounded-full bg-line mt-2 overflow-hidden">
              <View
                className="h-full bg-brand"
                style={{ width: `${Math.max(2, heroProgresso)}%` }}
              />
            </View>

            <View className="flex-row items-center justify-between mt-2.5">
              <Text className="text-[11px] text-ink" style={{ fontFamily: 'monospace' }}>
                {t('comum.bico').toUpperCase()} {(emTrabalho?.status?.TempOfNozzle ?? 0).toFixed(0)}°
              </Text>
              <Text className="text-[11px] text-ink" style={{ fontFamily: 'monospace' }}>
                {t('comum.mesa').toUpperCase()} {(emTrabalho?.status?.TempOfHotbed ?? 0).toFixed(0)}°
              </Text>
              <Text className="text-[11px] text-ink-soft" style={{ fontFamily: 'monospace' }}>
                {t('home.ventoinhas').toUpperCase()} {heroVent?.ModelFan ?? 0}/{(heroVent?.BoxFan ?? 0)}/{(heroVent?.AuxiliaryFan ?? 0)}%
              </Text>
            </View>
          </View>
        )}

        {printers.length === 0 ? (
          <View className="flex-1 pt-10">
            <Image
              source={require('../../assets/CC.png')}
              className="w-24 h-24 self-center"
              resizeMode="contain"
            />
            <Text className="mt-6 text-[22px] font-bold text-ink text-center">
              {t('home.semImpressoras')}
            </Text>
            <Text className="mt-2 text-[13px] leading-[20px] text-ink-muted text-center px-6">
              {t('home.primeiraImpressoraMsg')}
            </Text>

            <TouchableOpacity
              className={`mt-8 py-4 ${BT_ACENTO}`}
              onPress={() => navigation.navigate('Discovery')}
              activeOpacity={0.85}
            >
              <Ionicons name="wifi" size={18} color={hexDe(tema.paleta.acentoTexto)} />
              <Text className={`ml-2 text-[15px] ${TX_ACENTO}`}>
                {t('home.analisarRede')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 py-3 items-center"
              onPress={() => navigation.navigate('AddEditPrinter')}
              activeOpacity={0.7}
            >
              <Text className="text-ink-soft font-semibold text-[14px]">
                {t('home.adicionarManualmente')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {printers.map(printer => (
              <View key={printer.id} className="mb-3">
                <PrinterCard
                  printer={printer}
                  showPrintControls
                  onPrintControl={() =>
                    handlePrintControl(
                      printer.id,
                      printer.status?.PrintInfo?.Status || 0
                    )
                  }
                  onStopPrint={() =>
                    handleStopPrint(printer.id, printer.printerName)
                  }
                  onPress={() => handlePrinterPress(printer.id)}
                />
              </View>
            ))}

            <TouchableOpacity
              className="mt-2 rounded-xl2 border border-line py-3.5 items-center flex-row justify-center"
              onPress={() => navigation.navigate('AddEditPrinter')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={hexDe(tema.paleta.tintaSoft)} />
              <Text className="ml-1.5 text-ink-soft font-semibold text-[14px]">
                {t('home.adicionarImpressora')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 py-3 items-center flex-row justify-center"
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color={hexDe(tema.paleta.tintaMuted)} />
              <Text className="ml-1.5 text-ink-muted font-semibold text-[13px]">
                {t('home.historicoImpressoes')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-2 items-center flex-row justify-center"
              onPress={() => navigation.navigate('Stats')}
              activeOpacity={0.7}
            >
              <Ionicons name="stats-chart-outline" size={16} color={hexDe(tema.paleta.tintaMuted)} />
              <Text className="ml-1.5 text-ink-muted font-semibold text-[13px]">
                {t('home.estatisticas')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
