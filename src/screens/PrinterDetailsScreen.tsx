import { enderecoDe } from '../utils/rede';
import { log } from '../utils/log';
import { mensagemDoErro } from '../utils/errors';
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
import Svg, { Circle } from 'react-native-svg';
import { Estratos } from '../components/Estratos';
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
  fanCommand,
  printSpeedCommand,
  timelapseCommand,
  type SdcpCommand,
} from '../utils/commands';
import { t } from '../i18n';
import type { ConnectionStatus } from '../types';
import { classificarEstado } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { BT_ACENTO, BT_APAGADA, BT_NEUTRA, BT_PERIGO, TX_ACENTO, TX_PERIGO } from '../theme/botoes';

// Etiquetas visíveis para o estado de ligação da impressora (chaves i18n).
const ANEL_TAM = 196;
const ANEL_TRACO = 8;
const ANEL_RAIO = (ANEL_TAM - ANEL_TRACO) / 2;
const ANEL_CIRC = 2 * Math.PI * ANEL_RAIO;

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
  const { printers, sendCommand, request, reconnectAll, removePrinter } =
    usePrinterConnections();
  const printer = printers.find(p => p.id === printerId);

  const [refreshing, setRefreshing] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [emPausa, setEmPausa] = useState(false);
  const ultimosTicks = useRef({ valor: -1, desde: Date.now() });
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
        // Em segundo plano os timers param: ao voltar, os ticks ficam
        // "parados" durante minutos e dariam uma pausa falsa. Repor o marco.
        ultimosTicks.current = {
          valor: ultimosTicks.current.valor,
          desde: Date.now(),
        };
        setEmPausa(false);
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

  // A máquina NÃO muda o Status ao pausar (fica 6, igual a imprimir); o sinal
  // fiável é o CurrentTicks parar de avançar. 6 s parado = em pausa.
  const handlePrintControl = async () => {
    if (!printer) return;
    try {
      if (emPausa) {
        await request(
          printer.id,
          resumePrintCommand({ id: `resume-${Date.now()}` })
        );
        setEmPausa(false);
        ultimosTicks.current = {
          valor: ultimosTicks.current.valor,
          desde: Date.now(),
        };
      } else {
        await request(
          printer.id,
          pausePrintCommand({ id: `pause-${Date.now()}` })
        );
      }
    } catch (erro) {
      Alert.alert('Comando recusado', mensagemDoErro(erro));
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
          onPress: async () => {
            try {
              await request(
                printer.id,
                stopPrintCommand({ id: `cancel-${Date.now()}` })
              );
            } catch (erro) {
              Alert.alert('Comando recusado', mensagemDoErro(erro));
            }
          },
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

  const aplicarPreset = async (preset: (typeof PRESETS)[number]) => {
    if (!printer) return;
    const id = `${printer.printerName}-preset-${Date.now()}`;
    setSpeedPercent(preset.pct);
    setFanSpeeds(preset.fans);
    try {
      await request(printer.id, printSpeedCommand(preset.pct, { id }));
      // As ventoinhas vão pelo mesmo caminho dos controlos manuais; o valor
      // aplicado só é dado como certo quando a máquina responde Ack 0.
      await request(printer.id, fanCommand(preset.fans, { id }));
      const luzAgora = !!printer.status?.LightStatus?.SecondLight;
      if (luzAgora !== preset.luz) {
        await request(printer.id, lightCommand(preset.luz, { id }));
      }
    } catch (erro) {
      Alert.alert('Comando recusado', mensagemDoErro(erro));
    }
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

  // Tem de ficar ANTES do return antecipado de `!printer`, senão o número de
  // hooks muda entre renders e o React rebenta.
  useEffect(() => {
    const id = setInterval(() => {
      const st = printer?.status?.PrintInfo;
      const valor = st?.CurrentTicks ?? 0;
      const emCurso = !!st?.Filename && ![0, 7, 8, 9].includes(st.Status ?? 0);
      if (valor !== ultimosTicks.current.valor) {
        ultimosTicks.current = { valor, desde: Date.now() };
        setEmPausa(false);
        return;
      }
      if (emCurso && valor > 0 && Date.now() - ultimosTicks.current.desde > 6000) {
        setEmPausa(true);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [printer?.status?.PrintInfo?.CurrentTicks, printer?.status?.PrintInfo?.Status]);

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
            className={`mt-4 px-6 py-3 ${BT_ACENTO}`}
          >
            <Text className={TX_ACENTO}>{t('details.voltar')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isLightOn = printer.status?.LightStatus?.SecondLight === 1;
  const isConnected = printer.connectionStatus === 'connected';
  const printStatus = info?.Status || 0;
  // Códigos vistos na máquina: 0 parada, 1/16/20 preparação (o 20 também
  // aparece em pausa), 13 arranque, 6 a imprimir, 5 transição, 7 a parar,
  // 8 parada. Por isso o critério é ter trabalho e não estar parada/acabada.
  // 9 = terminada (o firmware mantém ficheiro e progresso).
  const codigosParado = [0, 7, 8, 9];
  const isPrinting =
    !!info?.Filename && !codigosParado.includes(printStatus);
  const estado = classificarEstado(info, emPausa);

  const restanteSegundos = Math.max(
    0,
    Math.round((info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0))
  );
  const horaFim =
    restanteSegundos > 0
      ? (() => {
          const fim = new Date(Date.now() + restanteSegundos * 1000);
          return `${String(fim.getHours()).padStart(2, '0')}:${String(
            fim.getMinutes()
          ).padStart(2, '0')}`;
        })()
      : null;

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

  // Presets por material: velocidade, ventoinhas e luz de uma vez.
  const PRESETS = [
    { id: 'pla', label: 'PLA', pct: 100, fans: { model: 100, side: 0, chamber: 0 }, luz: false },
    { id: 'abs', label: 'ABS', pct: 130, fans: { model: 60, side: 0, chamber: 80 }, luz: true },
    { id: 'silencioso', label: t('details.silencioso'), pct: 50, fans: { model: 50, side: 0, chamber: 0 }, luz: false },
  ];

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
            ? `${enderecoDe(printer)} · ${t('comum.ligada')}`
            : printer.reconnectAttempt
              ? t('details.aReconectarUpper', { n: printer.reconnectAttempt })
              : t(CONNECTION_LABEL[printer.connectionStatus]).toUpperCase()
        }
        onBack={() => navigation.goBack()}
      />

      {!isConnected && printer.status && (
        <View className="mx-4 mb-1 rounded-xl2 border border-line bg-canvas-sunken px-3 py-2 flex-row items-center">
          <Ionicons name="cloud-offline-outline" size={13} color={hexDe(tema.paleta.tintaSoft)} />
          <Text className="ml-2 text-[11px] text-ink-soft">
            {printer.lastUpdate
              ? t('details.ultimoEstado', {
                  hora: new Date(printer.lastUpdate).toLocaleTimeString('pt-PT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })
              : t('details.semLigacao')}
          </Text>
        </View>
      )}

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
        {/* Anel de progresso com a câmara dentro */}
        <View className="items-center mt-1">
          <View style={{ width: ANEL_TAM, height: ANEL_TAM }}>
            <Svg width={ANEL_TAM} height={ANEL_TAM}>
              <Circle
                cx={ANEL_TAM / 2}
                cy={ANEL_TAM / 2}
                r={ANEL_RAIO}
                stroke={hexDe(tema.paleta.linha)}
                strokeWidth={ANEL_TRACO}
                fill="none"
              />
              <Circle
                cx={ANEL_TAM / 2}
                cy={ANEL_TAM / 2}
                r={ANEL_RAIO}
                stroke={hexDe(
                  estado === 'paused' ? tema.paleta.aviso : tema.paleta.acento
                )}
                strokeWidth={ANEL_TRACO}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${ANEL_CIRC} ${ANEL_CIRC}`}
                strokeDashoffset={ANEL_CIRC * (1 - Math.max(0, Math.min(100, progress)) / 100)}
                transform={`rotate(-90 ${ANEL_TAM / 2} ${ANEL_TAM / 2})`}
              />
            </Svg>

            <View
              className="absolute items-center justify-center"
              style={{
                top: ANEL_TRACO + 7,
                left: ANEL_TRACO + 7,
                width: ANEL_TAM - 2 * (ANEL_TRACO + 7),
                height: ANEL_TAM - 2 * (ANEL_TRACO + 7),
              }}
            >
              {printer.videoUrl && isConnected ? (
                <View
                  style={{
                    width: ANEL_TAM - 2 * (ANEL_TRACO + 7),
                    height: ANEL_TAM - 2 * (ANEL_TRACO + 7),
                    borderRadius: ANEL_TAM,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                  }}
                >
                <WebView
                  key={webViewKey}
                  source={{
                    html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}img{width:100%;height:100%;object-fit:cover;display:block}</style></head><body><img src="http://${enderecoDe(printer)}:3031/video" /></body></html>`,
                    baseUrl: `http://${enderecoDe(printer)}`,
                  }}
                  style={{
                    width: ANEL_TAM - 2 * (ANEL_TRACO + 7),
                    height: ANEL_TAM - 2 * (ANEL_TRACO + 7),
                    backgroundColor: '#000',
                  }}
                  javaScriptEnabled
                  domStorageEnabled={false}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  mixedContentMode="always"
                  originWhitelist={['*']}
                  scrollEnabled={false}
                  bounces={false}
                  onHttpError={e => log('DETAIL_HTTP_ERR', JSON.stringify(e.nativeEvent))}
                  onError={e => log('DETAIL_WV_ERR', JSON.stringify(e.nativeEvent))}
                  onLoadEnd={() => log('DETAIL_WV_LOADED')}
                />
                </View>
              ) : (
                <Ionicons name="videocam-off" size={26} color="rgba(255,255,255,0.45)" />
              )}

              <View
                className="absolute items-center justify-center"
                pointerEvents="none"
              >
                <View className="px-2.5 py-1 rounded-lg bg-black/35">
                  <Text
                    className="text-white font-bold"
                    style={{ fontFamily: 'monospace', fontSize: 32, lineHeight: 36 }}
                  >
                    {progress}
                    <Text style={{ fontSize: 13 }}> %</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text
            className="mt-3 text-[24px] font-semibold text-ink"
            style={{ fontFamily: 'monospace' }}
          >
            {isPrinting ? remaining : '—'}
          </Text>
          <Text className="mt-0.5 text-[11px] text-ink-muted">
            {estado === 'paused'
              ? t('estado.emPausa')
              : isPrinting && horaFim
                ? t('details.restantesFim', { hora: horaFim })
                : t('camera.inativa')}
          </Text>
        </View>

        {/* Estratos: as camadas reais do trabalho, do piso para cima */}
        {isPrinting && info && (
          <View className="mt-4 items-center">
            <Estratos
              actual={info.CurrentLayer}
              total={info.TotalLayer}
              progresso={progress}
              tipo="fdm"
              altura={220}
            />
          </View>
        )}

        {/* Cápsulas de telemetria */}
        <View className="flex-row mt-5" style={{ gap: 8 }}>
          <View className="flex-1 border border-line rounded-lg px-3 py-2">
            <Text className="text-[9px] tracking-[1.2px] font-semibold text-ink-soft">
              {t('comum.bico').toUpperCase()}
            </Text>
            <Text className="mt-0.5 text-[17px] font-bold text-ink" style={{ fontFamily: 'monospace' }}>
              {(printer.status?.TempOfNozzle ?? 0).toFixed(0)}°
            </Text>
          </View>
          <View className="flex-1 border border-line rounded-lg px-3 py-2">
            <Text className="text-[9px] tracking-[1.2px] font-semibold text-ink-soft">
              {t('comum.mesa').toUpperCase()}
            </Text>
            <Text className="mt-0.5 text-[17px] font-bold text-ink" style={{ fontFamily: 'monospace' }}>
              {(printer.status?.TempOfHotbed ?? 0).toFixed(0)}°
            </Text>
          </View>
          <View className="flex-1 border border-line rounded-lg px-3 py-2">
            <Text className="text-[9px] tracking-[1.2px] font-semibold text-ink-soft">
              {t('comum.camadaTitulo').toUpperCase()}
            </Text>
            <Text className="mt-0.5 text-[17px] font-bold text-ink" style={{ fontFamily: 'monospace' }}>
              {isPrinting && (info?.TotalLayer ?? 0) > 0
                ? `${info?.CurrentLayer ?? 0}/${info?.TotalLayer ?? 0}`
                : '—'}
            </Text>
          </View>
        </View>

        {/* Acções de impressão */}
        {isConnected && isPrinting && (
          <View className="flex-row mt-3" style={{ gap: 10 }}>
            {(isConnected && isPrinting) && (
              <TouchableOpacity
                onPress={handlePrintControl}
                className="flex-1 h-11 rounded-xl bg-brand items-center justify-center flex-row"
                activeOpacity={0.8}
              >
                <Ionicons name={emPausa ? 'play' : 'pause'} size={15} color="#FFFFFF" />
                <Text className="ml-1.5 text-[13px] font-semibold text-white">
                  {emPausa ? t('comum.retomar') : t('comum.pausar')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleStopPrint}
              className="flex-1 h-11 rounded-xl border border-state-danger items-center justify-center flex-row"
              activeOpacity={0.8}
            >
              <Ionicons name="stop" size={15} color={hexDe(tema.paleta.perigo)} />
              <Text className="ml-1.5 text-[13px] font-semibold text-state-danger">
                {t('comum.parar')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
              {PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.id}
                  disabled={!isConnected}
                  onPress={() => aplicarPreset(preset)}
                  activeOpacity={0.7}
                  className="flex-1 mr-1.5 py-2 rounded-lg items-center bg-canvas-sunken border border-line"
                >
                  <Text className="text-[10px] font-semibold text-ink-soft" numberOfLines={1}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
              {enderecoDe(printer)}
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
