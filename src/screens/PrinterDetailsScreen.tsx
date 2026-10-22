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
import type { ConnectionStatus } from '../types';

// Etiquetas visíveis para o estado de ligação da impressora.
const CONNECTION_LABEL: { [key in ConnectionStatus]: string } = {
  connected: 'Ligada',
  connecting: 'A ligar',
  disconnected: 'Desligada',
  error: 'Erro',
  timeout: 'Tempo esgotado',
};

export const PrinterDetailsScreen = ({ navigation }: any) => {
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
      sendCommand(printer.id, {
        Id: '',
        Data: {
          Cmd: 129,
          Data: {},
          RequestID: `pause-${Date.now()}`,
          MainboardID: '',
          TimeStamp: Date.now(),
          From: 1,
        },
      });
    } else if (canResume) {
      sendCommand(printer.id, {
        Id: '',
        Data: {
          Cmd: 131,
          Data: {},
          RequestID: `resume-${Date.now()}`,
          MainboardID: '',
          TimeStamp: Date.now(),
          From: 1,
        },
      });
    }
  };

  const handleStopPrint = () => {
    if (!printer) return;
    Alert.alert(
      'Cancelar impressão',
      'Esta ação interrompe a impressão e é irreversível.',
      [
        { text: 'Continuar a impressão', style: 'cancel' },
        {
          text: 'Parar impressão',
          style: 'destructive',
          onPress: () =>
            sendCommand(printer.id, {
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
    sendCommand(printer.id, {
      Id: `${printer.printerName}-id-${Date.now()}`,
      Data: {
        Cmd: 403,
        Data: { LightStatus: { SecondLight: isOn } },
        RequestID: `light-toggle-${Date.now()}`,
        MainboardID: '',
        TimeStamp: 0,
        From: 1,
      },
    });
  };

  const handleFanSpeed = (
    fanType: 'model' | 'chamber' | 'side',
    speed: number
  ) => {
    if (!printer) return;

    const next = { ...fanSpeeds, [fanType]: speed };
    setFanSpeeds(next);

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
    sendCommand(printer.id, {
      Id: `${printer.printerName}-id-${Date.now()}`,
      Data: {
        Cmd: 403,
        Data: { PrintSpeedPct: percent },
        RequestID: `speed-${percent}-${Date.now()}`,
        MainboardID: '',
        TimeStamp: 0,
        From: 1,
      },
    });
  };

  const handleTimelapse = (enabled: boolean) => {
    if (!printer) return;
    setTimelapse(enabled);
    sendCommand(printer.id, {
      Id: `${printer.printerName}-id-${Date.now()}`,
      Data: {
        Cmd: 387,
        Data: { Enable: enabled ? 1 : 0 },
        RequestID: `timelapse-${Date.now()}`,
        MainboardID: '',
        TimeStamp: 0,
        From: 1,
      },
    });
  };

  const handleQuickCommand = (cmd: 132 | 133) => {
    if (!printer) return;
    sendCommand(printer.id, {
      Id: `${printer.printerName}-id-${Date.now()}`,
      Data: {
        Cmd: cmd,
        Data: {},
        RequestID: `quick-${cmd}-${Date.now()}`,
        MainboardID: '',
        TimeStamp: 0,
        From: 1,
      },
    });
  };

  const handleDeletePrinter = () => {
    if (!printer) return;
    Alert.alert(
      'Desassociar impressora',
      `Remover ${printer.printerName}? Esta ação é irreversível.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desassociar',
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
        <Header title="Impressora" onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-ink-muted text-center">
            Esta impressora já não está disponível.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 rounded-xl2 bg-brand px-6 py-3"
          >
            <Text className="text-white font-semibold">Voltar</Text>
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
      label: 'BICO',
      value: printer.status?.TempOfNozzle ?? 0,
      target: printer.status?.TempTargetNozzle ?? 0,
    },
    {
      label: 'MESA',
      value: printer.status?.TempOfHotbed ?? 0,
      target: printer.status?.TempTargetHotbed ?? 0,
    },
    {
      label: 'CÂMARA',
      value: printer.status?.TempOfBox ?? 0,
      target: printer.status?.TempTargetBox ?? 0,
    },
  ];

  const fanRows = [
    {
      key: 'model' as const,
      label: 'Ventoinha do modelo',
      icon: 'cube-outline',
      speed: fanSpeeds.model,
    },
    {
      key: 'chamber' as const,
      label: 'Ventoinha da câmara',
      icon: 'thermometer-outline',
      speed: fanSpeeds.chamber,
    },
    {
      key: 'side' as const,
      label: 'Ventoinha lateral',
      icon: 'layers-outline',
      speed: fanSpeeds.side,
    },
  ];

  const FAN_STEPS = [0, 25, 50, 75, 100];

const SPEED_PROFILES = [
  { label: 'Silencioso', percent: 50 },
  { label: 'Normal', percent: 100 },
  { label: 'Desporto', percent: 130 },
  { label: 'Ludicrous', percent: 160 },
];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={formatTextMaxEllipsis(printer.printerName, 26)}
        subtitle={
          isConnected
            ? `${printer.ipAddress} · Ligada`
            : CONNECTION_LABEL[printer.connectionStatus].toUpperCase()
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
            tintColor="#3E6AE1"
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
              <Ionicons name="videocam-off" size={32} color="#7C8088" />
              <Text className="mt-2 text-[12px] text-white/60">
                {isConnected ? 'À espera do vídeo' : 'Impressora desligada'}
              </Text>
            </View>
          )}

          {isConnected && (
            <View className="absolute top-3 left-3 flex-row items-center rounded-full bg-black/55 px-2.5 py-1">
              <View className="w-1.5 h-1.5 rounded-full bg-[#FF4757] mr-1.5" />
              <Text className="text-white text-[10px] font-bold tracking-widest">
                EM DIRETO
              </Text>
            </View>
          )}
          <View className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/55 items-center justify-center">
            <Ionicons name="expand" size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Print job */}
        {isConnected && isPrinting && (
          <View className="mt-4 rounded-xl2 border border-line bg-white p-4">
            <View className="flex-row items-start justify-between">
              <Text className="text-[10px] tracking-widest font-semibold text-ink-soft">
                {printStatus === 6 ? 'EM PAUSA' : 'A IMPRIMIR'}
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
              {info?.Filename || 'Sem ficheiro'}
            </Text>

            <View className="mt-3 h-[5px] rounded-full bg-[#DCDCDC] overflow-hidden">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, progress)}%` }}
              />
            </View>

            <View className="flex-row justify-between mt-2.5">
              <Text className="text-[12px] text-ink-muted">
                Camada {info?.CurrentLayer ?? 0}/{info?.TotalLayer ?? 0}
              </Text>
              <Text className="text-[12px] text-ink-muted">
                {remaining} restantes
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
                    color="#171A20"
                  />
                  <Text className="ml-1.5 text-[13px] font-semibold text-ink">
                    {canResume ? 'Retomar' : 'Pausar'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleStopPrint}
                className="flex-1 rounded-xl2 border border-line py-3 flex-row items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="stop" size={15} color="#C62828" />
                <Text className="ml-1.5 text-[13px] font-semibold text-[#C62828]">
                  Parar
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
                {tile.label}
              </Text>
              <Text className="mt-1 text-[19px] font-bold text-ink">
                {tile.value.toFixed(0)}
                <Text className="text-[11px] font-medium text-ink-muted">
                  °
                </Text>
              </Text>
              <Text className="text-[11px] text-ink-muted">
                alvo {tile.target.toFixed(0)}°
              </Text>
            </View>
          ))}
        </View>

        {/* Controls */}
        <View className="mt-4 rounded-xl2 border border-line bg-white">
          <Text className="px-4 pt-4 pb-1 text-[10px] tracking-widest font-semibold text-ink-soft">
            CONTROLOS
          </Text>

          {/* Light */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <View className="flex-row items-center flex-1">
              <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
                <Ionicons
                  name={isLightOn ? 'bulb' : 'bulb-outline'}
                  size={16}
                  color={isLightOn ? '#3E6AE1' : '#3F444D'}
                />
              </View>
              <Text className="ml-3 text-[14px] font-medium text-ink">
                Luz da impressora
              </Text>
            </View>
            <Switch
              value={isLightOn}
              onValueChange={handleLightToggle}
              disabled={!isConnected}
              trackColor={{ false: '#E4E4E4', true: '#3E6AE1' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E4E4E4"
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
                      color={row.speed > 0 ? '#3E6AE1' : '#3F444D'}
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
                  <Ionicons name="speedometer-outline" size={16} color="#3F444D" />
                </View>
                <Text className="ml-3 text-[14px] font-medium text-ink">Velocidade</Text>
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
                      active ? 'bg-brand' : 'bg-canvas-sunken border border-line'
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
                <Ionicons name="film-outline" size={16} color={timelapse ? '#3E6AE1' : '#3F444D'} />
              </View>
              <View className="ml-3">
                <Text className="text-[14px] font-medium text-ink">Time-lapse</Text>
                <Text className="text-[11px] text-ink-muted">
                  Gravado pela própria impressora
                </Text>
              </View>
            </View>
            <Switch
              value={timelapse}
              onValueChange={handleTimelapse}
              disabled={!isConnected}
              trackColor={{ false: '#E4E4E4', true: '#3E6AE1' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E4E4E4"
            />
          </View>

          {/* Emergência */}
          <View className="px-4 py-3 border-t border-line">
            <Text className="text-[11px] font-semibold tracking-widest text-ink-muted">
              DURANTE A IMPRESSÃO
            </Text>
            <View className="flex-row mt-2">
              <TouchableOpacity
                disabled={!isConnected}
                onPress={() => handleQuickCommand(133)}
                className="flex-1 rounded-xl border border-line py-2.5 items-center mr-1.5"
                activeOpacity={0.7}
              >
                <Text className="text-[12px] font-semibold text-ink">
                  Saltar pré-aquecimento
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!isConnected}
                onPress={() => handleQuickCommand(132)}
                className="flex-1 rounded-xl border border-line py-2.5 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-[12px] font-semibold text-ink">
                  Parar filamento
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Printer */}
        <View className="mt-4 rounded-xl2 border border-line bg-white">
          <Text className="px-4 pt-4 pb-1 text-[10px] tracking-widest font-semibold text-ink-soft">
            IMPRESSORA
          </Text>
          <View className="flex-row items-center justify-between px-4 py-3 border-t border-line">
            <View>
              <Text className="text-[13px] font-medium text-ink">Ligação</Text>
              <Text className="text-[11px] text-ink-muted">
                Direta por LAN · SDCP
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
            <Ionicons name="trash-outline" size={16} color="#C62828" />
            <Text className="ml-2 text-[13px] font-semibold text-[#C62828]">
              Desassociar impressora
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
