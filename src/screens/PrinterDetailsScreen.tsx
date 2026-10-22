import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { WebView } from 'react-native-webview';
import { useRoute } from '@react-navigation/native';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import {
  formatTextMaxEllipsis,
  formatTicksToReadableTime,
} from '~/utils/FormatUtils';
import {
  pausePrintCommand,
  resumePrintCommand,
  stopPrintCommand,
  skipPreheatCommand,
  stopFilamentCommand,
  lightCommand,
  printSpeedCommand,
  timelapseCommand,
  type SdcpCommand,
} from '../utils/commands';
import { t } from '../i18n';
import type { ConnectionStatus } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

// Etiquetas visíveis para o estado de ligação da impressora (chaves i18n).
const CONNECTION_LABEL: { [key in ConnectionStatus]: string } = {
  connected: 'comum.ligada',
  connecting: 'comum.aLigar',
  disconnected: 'comum.desligada',
  error: 'comum.erro',
  timeout: 'comum.tempoEsgotado',
};

export const PrinterDetailsScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const route = useRoute();
  const { printerId } = route.params as { printerId: string };
  const { printers, sendCommand, reconnectAll, removePrinter } =
    usePrinterConnections();
  const printer = printers.find(p => p.id === printerId);

  const [refreshing, setRefreshing] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [speedPercent, setSpeedPercent] = useState(100);
  const [timelapse, setTimelapse] = useState(false);
  const [fanSpeeds, setFanSpeeds] = useState({
    model: 0,
    chamber: 0,
    side: 0,
  });
  const appState = useRef(AppState.currentState);

  // Remount the stream when the app comes back from the background.
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        setWebViewKey(prevKey => prevKey + 1);
      }
      appState.current = nextAppState;
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (printer?.status?.CurrentFanSpeed) {
      setFanSpeeds({
        model: printer.status.CurrentFanSpeed.ModelFan || 0,
        chamber: printer.status.CurrentFanSpeed.BoxFan || 0,
        side: printer.status.CurrentFanSpeed.AuxiliaryFan || 0,
      });
    }
  }, [printer?.status?.CurrentFanSpeed]);

  const handlePrintControl = () => {
    if (!printer) return;
    const printStatusFromPrinter = printer.status?.PrintInfo?.Status || 0;
    const canPause = printStatusFromPrinter === 13;
    const canResume = printStatusFromPrinter === 6;
    if (canPause) {
      sendCommand(printer.id, pausePrintCommand({ id: `pause-${Date.now()}` }));
    } else if (canResume) {
      sendCommand(
        printer.id,
        resumePrintCommand({ id: `resume-${Date.now()}` })
      );
    }
  };

  const handleStopPrint = () => {
    if (!printer) return;
    Alert.alert(
      t('comum.cancelarImpressao'),
      t('comum.interrompeImpressao'),
      [
        { text: t('comum.continuarImpressao'), style: 'cancel' },
        {
          text: t('comum.pararImpressao'),
          style: 'destructive',
          onPress: () =>
            sendCommand(
              printer.id,
              stopPrintCommand({ id: `cancel-${Date.now()}` })
            ),
        },
      ]
    );
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reconnectAll();
    setWebViewKey(key => key + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, [reconnectAll]);

  const handleLightToggle = (isOn: boolean) => {
    if (!printer) return;
    sendCommand(
      printer.id,
      lightCommand(isOn, { id: `${printer.printerName}-id-${Date.now()}` })
    );
  };

  const handleFanSpeed = (
    fanType: 'model' | 'chamber' | 'side',
    speed: number
  ) => {
    if (!printer) return;

    const next = { ...fanSpeeds, [fanType]: speed };
    setFanSpeeds(next);

    // TargetFanSpeed não consta dos payloads confirmados do SDCP;
    // mantém-se construído à mão até ser validado contra a impressora.
    sendCommand(printer.id, {
      Id: `${printer.printerName}-id-${Date.now()}`,
      Data: {
        Cmd: 403,
        Data: {
          TargetFanSpeed: {
            ModelFan: next.model,
            AuxiliaryFan: next.side,
            BoxFan: next.chamber,
          },
        },
        RequestID: `${fanType}-fan-${speed}-${Date.now()}`,
        MainboardID: '',
        TimeStamp: 0,
        From: 1,
      },
    });
  };

  const handleSpeedProfile = (percent: number) => {
    if (!printer) return;
    setSpeedPercent(percent);
    sendCommand(
      printer.id,
      printSpeedCommand(percent, {
        id: `${printer.printerName}-id-${Date.now()}`,
      })
    );
  };

  const handleTimelapse = (enabled: boolean) => {
    if (!printer) return;
    setTimelapse(enabled);
    sendCommand(
      printer.id,
      timelapseCommand(enabled, { id: `timelapse-${Date.now()}` })
    );
  };

  // Envia um comando sem payload já construído (132/133).
  const handleQuickCommand = (comando: SdcpCommand<unknown>) => {
    if (!printer) return;
    sendCommand(printer.id, comando);
  };

  const handleDeletePrinter = () => {
    if (!printer) return;
    Alert.alert(
      t('details.desassociar'),
      t('details.desassociarMsg', { nome: printer.printerName }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('details.desassociar'),
          style: 'destructive',
          onPress: () => {
            removePrinter(printer.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const info = printer?.status?.PrintInfo;
  const progress = info?.Progress ?? 0;
  const remaining = useMemo(() => {
    const ticks = (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0);
    return ticks > 0 ? formatTicksToReadableTime(ticks) : '—';
  }, [info?.TotalTicks, info?.CurrentTicks]);

  if (!printer) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
        <Header title={t('details.title')} onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink-muted text-center">
            {t('details.jaNaoDisponivel')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 rounded-xl2 bg-brand px-6 py-3"
          >
            <Text className="text-white font-semibold">{t('details.voltar')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isLightOn = printer.status?.LightStatus?.SecondLight === 1;
  const isConnected = printer.connectionStatus === 'connected';
  const printStatus = info?.Status || 0;
  const canPause = printStatus === 13;
  const canResume = printStatus === 6;
  const isPrinting = printStatus === 13 || printStatus === 6;

  const temperatures = [
    {
      label: 'comum.bico',
      value: printer.status?.TempOfNozzle ?? 0,
      target: printer.status?.TempTargetNozzle ?? 0,
    },
    {
      label: 'comum.mesa',
      value: printer.status?.TempOfHotbed ?? 0,
      target: printer.status?.TempTargetHotbed ?? 0,
    },
    {
      label: 'comum.camara',
      value: printer.status?.TempOfBox ?? 0,
      target: printer.status?.TempTargetBox ?? 0,
    },
  ];

  const fanRows = [
    {
      key: 'model' as const,
      label: t('details.ventoinhaModelo'),
      icon: 'cube-outline',
      speed: fanSpeeds.model,
    },
    {
      key: 'chamber' as const,
      label: t('details.ventoinhaCamara'),
      icon: 'thermometer-outline',
      speed: fanSpeeds.chamber,
    },
    {
      key: 'side' as const,
      label: t('details.ventoinhaLateral'),
      icon: 'layers-outline',
      speed: fanSpeeds.side,
    },
  ];

  const FAN_STEPS = [0, 25, 50, 75, 100];

  const SPEED_PROFILES = [
    { label: t('details.silencioso'), percent: 50 },
    { label: t('details.normal'), percent: 100 },
    { label: t('details.desporto'), percent: 130 },
    { label: t('details.ludicrous'), percent: 160 },
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={formatTextMaxEllipsis(printer.printerName, 26)}
        subtitle={
          isConnected
            ? `${printer.ipAddress} · ${t('comum.ligada')}`
            : printer.reconnectAttempt
              ? t('details.aReconectarUpper', { n: printer.reconnectAttempt })
              : t(CONNECTION_LABEL[printer.connectionStatus]).toUpperCase()
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={hexDe(tema.paleta.acento)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Camera */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate('Camera', { printerId: printer.id })
          }
          className="rounded-xl2 overflow-hidden bg-ink"
          style={{ aspectRatio: 16 / 9 }}
        >
          {printer.videoUrl && isConnected ? (
            <WebView
              key={webViewKey}
              source={{ uri: 'http://' + printer.videoUrl }}
              style={{ flex: 1, backgroundColor: '#000' }}
              javaScriptEnabled={false}
              domStorageEnabled={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              scrollEnabled={false}
              bounces={false}
              pointerEvents="none"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="videocam-off" size={32} color={hexDe(tema.paleta.tintaMuted)} />
              <Text className="mt-2 text-[12px] text-white/60">
                {isConnected
                  ? t('details.aEsperaVideo')
                  : t('comum.impressoraDesligada')}
              </Text>
            </View>
          )}

          {isConnected && (
            <View className="absolute top-3 left-3 flex-row items-center rounded-full bg-black/55 px-2.5 py-1">
              <View className="w-1.5 h-1.5 rounded-full bg-[#FF4757] mr-1.5" />
              <Text className="text-white text-[10px] font-bold tracking-widest">
                {t('comum.emDireto')}
              </Text>
            </View>
          )}
          <View className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 items-center justify-center">
            <Ionicons name="expand" size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Print job */}
        {isConnected && isPrinting && (
          <View className="mt-4 rounded-xl2 border border-line bg-cartao p-4">
            <View className="flex-row items-start justify-between">
              <Text className="text-[10px] tracking-widest font-semibold text-ink-soft">
                {printStatus === 6
                  ? t('comum.emPausa').toUpperCase()
                  : t('comum.aImprimir').toUpperCase()}
              </Text>
              <Text className="text-[26px] font-bold text-ink leading-none">
                {progress}
                <Text className="text-[13px] font-semibold text-ink-muted">
                  %
                </Text>
              </Text>
            </View>

            <Text
              className="mt-2 text-[12px] text-ink-soft"
              numberOfLines={1}
              style={{ fontFamily: 'monospace' }}
            >
              {info?.Filename || t('details.semFicheiro')}
            </Text>

            <View className="mt-3 h-[5px] rounded-full bg-line overflow-hidden">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, progress)}%` }}
              />
            </View>

            <View className="flex-row justify-between mt-2.5">
              <Text className="text-[12px] text-ink-muted">
                {t('comum.camada', {
                  actual: info?.CurrentLayer ?? 0,
                  total: info?.TotalLayer ?? 0,
                })}
              </Text>
              <Text className="text-[12px] text-ink-muted">
                {t('comum.restantes', { t: remaining })}
              </Text>
            </View>

            <View className="flex-row mt-4">
              {(canPause || canResume) && (
                <TouchableOpacity
                  onPress={handlePrintControl}
                  className="flex-1 rounded-xl2 border border-line py-3 mr-2 flex-row items-center justify-center"
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={canResume ? 'play' : 'pause'}
                    size={15}
                    color={hexDe(tema.paleta.tinta)}
                  />
                  <Text className="ml-1.5 text-[13px] font-semibold text-ink">
                    {canResume ? t('comum.retomar') : t('comum.pausar')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleStopPrint}
                className="flex-1 rounded-xl2 border border-line py-3 flex-row items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="stop" size={15} color={hexDe(tema.paleta.perigo)} />
                <Text className="ml-1.5 text-[13px] font-semibold text-state-danger">
                  {t('comum.parar')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Temperatures */}
        <View className="mt-4 flex-row">
          {temperatures.map((tile, index) => (
            <View
              key={tile.label}
              className={`flex-1 rounded-xl2 bg-canvas-sunken py-3 px-3 ${
                index < temperatures.length - 1 ? 'mr-2' : ''
              }`}
            >
              <Text className="text-[9px] tracking-widest font-semibold text-ink-soft">
                {t(tile.label).toUpperCase()}
              </Text>
              <Text className="mt-1 text-[19px] font-bold text-ink">
                {tile.value.toFixed(0)}
                <Text className="text-[11px] font-medium text-ink-muted">
                  °
                </Text>
              </Text>
              <Text className="text-[11px] text-ink-muted">
                {t('details.alvo', { t: tile.target.toFixed(0) })}
              </Text>
            </View>
          ))}
        </View>

        {/* Controls */}
        <View className="mt-4 rounded-xl2 border border-line bg-cartao">
          <Text className="px-4 pt-4 pb-1 text-[10px] tracking-widest font-semibold text-ink-soft">
            {t('details.controlos')}
          </Text>

          {/* Light */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center flex-1">
              <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
                <Ionicons
                  name={isLightOn ? 'bulb' : 'bulb-outline'}
                  size={16}
                  color={isLightOn ? hexDe(tema.paleta.acento) : hexDe(tema.paleta.tintaSoft)}
                />
              </View>
              <Text className="ml-3 text-[14px] font-medium text-ink">
                {t('details.luzImpressora')}
              </Text>
            </View>
            <Switch
              value={isLightOn}
              onValueChange={handleLightToggle}
              disabled={!isConnected}
              trackColor={{ false: hexDe(tema.paleta.linha), true: hexDe(tema.paleta.acento) }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={hexDe(tema.paleta.linha)}
            />
          </View>

          {/* Fans */}
          {fanRows.map(row => (
            <View key={row.key} className="px-4 py-3 border-t border-line">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
                    <Ionicons
                      name={row.icon as any}
                      size={16}
                      color={row.speed > 0 ? hexDe(tema.paleta.acento) : hexDe(tema.paleta.tintaSoft)}
                    />
                  </View>
                  <Text className="ml-3 text-[14px] font-medium text-ink">
                    {row.label}
                  </Text>
                </View>
                <Text className="text-[12px] font-semibold text-ink-soft">
                  {row.speed}%
                </Text>
              </View>

              <View className="flex-row mt-2.5 ml-11">
                {FAN_STEPS.map(step => {
                  const active = row.speed === step;
                  return (
                    <TouchableOpacity
                      key={step}
                      disabled={!isConnected}
                      onPress={() => handleFanSpeed(row.key, step)}
                      activeOpacity={0.7}
                      className={`flex-1 mr-1.5 py-1.5 rounded-lg items-center ${
                        active
                          ? 'bg-brand'
                          : 'bg-canvas-sunken border border-line'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${
                          active ? 'text-white' : 'text-ink-soft'
                        }`}
                      >
                        {step}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Velocidade */}
          <View className="px-4 py-3 border-t border-line">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
                  <Ionicons
                    name="speedometer-outline"
                    size={16}
                    color={hexDe(tema.paleta.tintaSoft)}
                  />
                </View>
                <Text className="ml-3 text-[14px] font-medium text-ink">
                  {t('details.velocidade')}
                </Text>
              </View>
              <Text className="text-[12px] font-semibold text-ink-soft">
                {speedPercent}%
              </Text>
            </View>
            <View className="flex-row mt-2.5 ml-11">
              {SPEED_PROFILES.map(profile => {
                const active = speedPercent === profile.percent;
                return (
                  <TouchableOpacity
                    key={profile.percent}
                    disabled={!isConnected}
                    onPress={() => handleSpeedProfile(profile.percent)}
                    activeOpacity={0.7}
                    className={`flex-1 mr-1.5 py-1.5 rounded-lg items-center ${
                      active
                        ? 'bg-brand'
                        : 'bg-canvas-sunken border border-line'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-semibold ${
                        active ? 'text-white' : 'text-ink-soft'
                      }`}
                      numberOfLines={1}
                    >
                      {profile.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Time-lapse */}
          <View className="px-4 py-3 border-t border-line flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
                <Ionicons
                  name="film-outline"
                  size={16}
                  color={timelapse ? hexDe(tema.paleta.acento) : hexDe(tema.paleta.tintaSoft)}
                />
              </View>
              <View className="ml-3">
                <Text className="text-[14px] font-medium text-ink">
                  {t('details.timelapse')}
                </Text>
                <Text className="text-[11px] text-ink-muted">
                  {t('details.gravadoImpressora')}
                </Text>
              </View>
            </View>
            <Switch
              value={timelapse}
              onValueChange={handleTimelapse}
              disabled={!isConnected}
              trackColor={{ false: hexDe(tema.paleta.linha), true: hexDe(tema.paleta.acento) }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={hexDe(tema.paleta.linha)}
            />
          </View>

          {/* Emergência */}
          <View className="px-4 py-3 border-t border-line">
            <Text className="text-[11px] font-semibold tracking-widest text-ink-muted">
              {t('details.duranteImpressao')}
            </Text>
            <View className="flex-row mt-2">
              <TouchableOpacity
                disabled={!isConnected}
                onPress={() => handleQuickCommand(skipPreheatCommand())}
                className="flex-1 rounded-xl border border-line py-2.5 items-center mr-1.5"
                activeOpacity={0.7}
              >
                <Text className="text-[12px] font-semibold text-ink">
                  {t('details.saltarPreaquecimento')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!isConnected}
                onPress={() => handleQuickCommand(stopFilamentCommand())}
                className="flex-1 rounded-xl border border-line py-2.5 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-[12px] font-semibold text-ink">
                  {t('details.pararFilamento')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Printer */}
        <View className="mt-4 rounded-xl2 border border-line bg-cartao">
          <Text className="px-4 pt-4 pb-1 text-[10px] tracking-widest font-semibold text-ink-soft">
            {t('details.seccaoImpressora')}
          </Text>
          <View className="flex-row items-center justify-between px-4 py-3 border-t border-line">
            <View>
              <Text className="text-[13px] font-medium text-ink">{t('details.ligacao')}</Text>
              <Text className="text-[11px] text-ink-muted">
                {t('details.diretaLan')}
              </Text>
            </View>
            <Text className="text-[12px] text-ink-muted">
              {printer.ipAddress}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleDeletePrinter}
            className="flex-row items-center px-4 py-3 border-t border-line"
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={hexDe(tema.paleta.perigo)} />
            <Text className="ml-2 text-[13px] font-semibold text-state-danger">
              {t('details.desassociar')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
