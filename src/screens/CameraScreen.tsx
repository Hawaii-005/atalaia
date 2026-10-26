import { enderecoDe } from '../utils/rede';
import { log } from '../utils/log';
import { mensagemDoErro } from '../utils/errors';
import { pausePrintCommand, resumePrintCommand, stopPrintCommand } from '../utils/commands';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import Svg, { Circle } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import { uploadGcode } from '../utils/gcodeUpload';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { htmlDoVideo } from '../utils/cameraStream';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { Header } from '../components/Header';
import { isResumable } from '../types';
import type { ConnectionStatus } from '../types';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { BT_ACENTO, BT_APAGADA, BT_NEUTRA, BT_PERIGO, TX_ACENTO, TX_PERIGO } from '../theme/botoes';

const LIGHT_COMMAND = 403;
const CAIXA_ANEL = 44;
const RAIO_ANEL = 18;
const TRACO_ANEL = 5;

// Etiquetas visíveis para o estado de ligação da impressora (chaves i18n).
const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connected: 'camera.impLigada',
  connecting: 'camera.impALigar',
  disconnected: 'camera.impDesligada',
  error: 'camera.impComErro',
  timeout: 'camera.impSemResposta',
};

/**
 * Modo poupança: uma fotografia a cada 2 s em vez do MJPEG (~1 MB/s).
 * Serve para quando estás fora de casa, por Tailscale ou dados móveis.
 */
const SnapshotAoVivo = ({
  host,
  activo,
  onFalhar,
}: {
  host: string;
  activo: boolean;
  onFalhar: () => void;
}) => {
  const [tick, setTick] = useState(0);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!activo || falhou) return;
    const id = setInterval(() => setTick(valor => valor + 1), 2000);
    return () => clearInterval(id);
  }, [activo, falhou]);
  if (falhou) return null;
  return (
    <Image
      source={{ uri: `http://${host}:3031/snapshot?t=${tick}` }}
      style={{ flex: 1, backgroundColor: '#000' }}
      resizeMode="cover"
      onError={() => {
        // Esta firmware responde 500 a /snapshot (só tem /video, MJPEG).
        // Em vez de ficar preto, avisa o ecrã para voltar ao vídeo.
        setFalhou(true);
        onFalhar();
      }}
    />
  );
};

export const CameraScreen = ({ navigation, route }: any) => {
  const { tema } = useTheme();
  // Keep the display awake while the camera tab is open.
  useKeepAwake();

  const { printers, sendCommand, request } = usePrinterConnections();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    route?.params?.printerId
  );
  const [lightOn, setLightOn] = useState(false);
  const [lastLightPress, setLastLightPress] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [pouparDados, setPouparDados] = useState(false);
  const [snapshotFalhou, setSnapshotFalhou] = useState(false);
  const emFoco = useIsFocused();
  const [fullscreen, setFullscreen] = useState(false);

  // O /snapshot desta firmware devolve 500; se falhar uma vez, fica no vídeo.
  useEffect(() => {
    setSnapshotFalhou(false);
  }, [selectedId]);

  // Preferência de poupança de dados (Definições → modo remoto).
  useEffect(() => {
    AsyncStorage.getItem('modoRemoto')
      .then(valor => setPouparDados(valor === '1'))
      .catch(() => undefined);
  }, []);
  const webViewRef = useRef<WebView>(null);
  const videoRef = useRef<View>(null);
  const [videoWidth, setVideoWidth] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  // Só o modo cheio roda para horizontal; fora dele a app segue o sensor (o
  // tablet usa horizontal). Bloquear em PORTRAIT_UP ao sair deixava a app
  // presa na vertical depois de abrir a câmara uma vez.
  useEffect(() => {
    const lock = async () => {
      try {
        await ScreenOrientation.lockAsync(
          fullscreen
            ? ScreenOrientation.OrientationLock.LANDSCAPE
            : ScreenOrientation.OrientationLock.DEFAULT
        );
      } catch (error) {
        log('orientation lock failed', error);
      }
    };
    lock();
  }, [fullscreen]);

  useEffect(() => () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => {}); }, []);

  // A resina não tem câmara: a aba só olha para as impressoras que têm vídeo.
  const comCamera = useMemo(() => printers.filter(p => p.kind !== 'resin'), [printers]);

  const printer = useMemo(() => {
    const bySelection = comCamera.find(p => p.id === selectedId);
    if (bySelection) {
      return bySelection;
    }
    return (
      comCamera.find(p => p.connectionStatus === 'connected') ?? comCamera[0]
    );
  }, [comCamera, selectedId]);

  const isConnected = printer?.connectionStatus === 'connected';
  const videoHost = printer ? enderecoDe(printer) : undefined;
  const printerId = printer?.id;
  const printerName = printer?.printerName;
  const lastVideoRequestRef = useRef<string>('');

  // Ask the printer to start the video stream (SDCP Cmd 386) once per
  // connection. sendCommand changes identity on every context render, so
  // without the guard this would re-send on every status tick.
  useEffect(() => {
    if (!printerId || !isConnected) {
      return;
    }
    const requestKey = `${printerId}:${videoHost}`;
    if (lastVideoRequestRef.current === requestKey) {
      return;
    }
    lastVideoRequestRef.current = requestKey;
    sendCommand(printerId, {
      Id: `${printerName}-video-${Date.now()}`,
      Data: {
        Cmd: 386,
        Data: { Enable: 1 },
        RequestID: `enable-video-${Date.now()}`,
        MainboardID: '',
        TimeStamp: Date.now(),
        From: 1,
      },
    });
  }, [printerId, printerName, isConnected, videoHost, sendCommand]);

  // Keep the switch in sync with the printer, unless the user just tapped it.
  useEffect(() => {
    if (!printer?.status) {
      return;
    }
    if (Date.now() - lastLightPress < 6000) {
      return;
    }
    setLightOn(printer.status.LightStatus?.SecondLight === 1);
  }, [printer?.status, lastLightPress]);

  const restartStream = useCallback(() => {
    if (!printerId) {
      return;
    }
    lastVideoRequestRef.current = `${printerId}:${videoHost}`;
    sendCommand(printerId, {
      Id: `${printerName}-video-${Date.now()}`,
      Data: {
        Cmd: 386,
        Data: { Enable: 1 },
        RequestID: `enable-video-${Date.now()}`,
        MainboardID: '',
        TimeStamp: Date.now(),
        From: 1,
      },
    });
    setReloadKey(key => key + 1);
    webViewRef.current?.reload();
  }, [printerId, printerName, sendCommand, videoHost]);

  const handlePrintControl = useCallback(async () => {
    if (!printer) return;
    // O botão diz "Retomar" no estado 20 e "Pausar" no resto: o comando segue
    // o mesmo critério, para nunca fazer o contrário do que está escrito.
    const retomar = isResumable(printer.status?.PrintInfo?.Status ?? 0);
    try {
      await request(
        printer.id,
        retomar
          ? resumePrintCommand({ id: `resume-${Date.now()}` })
          : pausePrintCommand({ id: `pause-${Date.now()}` })
      );
    } catch (erro) {
      Alert.alert('Comando recusado', mensagemDoErro(erro));
    }
  }, [printer, request]);

  const handleStopPrint = useCallback(() => {
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
  }, [printer, request]);

  const handleSnapshot = useCallback(async () => {
    if (!videoRef.current || capturing) {
      return;
    }
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t('camera.acessoGaleria'),
          t('camera.acessoGaleriaMsg')
        );
        return;
      }

      // The live card crops the feed to fill its box. For a snapshot we resize
      // the view to the frame's own 16:9 box, so the whole picture is captured.
      setCapturing(true);
      webViewRef.current?.injectJavaScript(
        "document.getElementById('stream').style.objectFit = 'contain'; true;"
      );
      await new Promise(resolve => setTimeout(resolve, 500));

      const uri = await captureRef(videoRef, { format: 'jpg', quality: 0.92 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(t('camera.guardado'), t('camera.guardadoMsg'));
    } catch (error) {
      Alert.alert(t('camera.erroCaptura'), String(error));
    } finally {
      setCapturing(false);
      webViewRef.current?.injectJavaScript(
        "document.getElementById('stream').style.objectFit = 'cover'; true;"
      );
    }
  }, [capturing]);

  const handleUpload = useCallback(async () => {
    if (!printer || uploading) {
      return;
    }
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) {
      return;
    }
    const asset = picked.assets[0];
    setUploading(true);
    setUploadPercent(0);
    try {
      await uploadGcode(
        enderecoDe(printer),
        asset.uri,
        asset.name,
        (enviado, total) => {
          // Bloco aceite pela impressora: actualiza a barra e a percentagem.
          setUploadPercent(Math.round((enviado / total) * 100));
        }
      );
      Alert.alert(t('camera.enviado'), t('camera.enviadoMsg', { nome: asset.name }));
    } catch (error) {
      Alert.alert(t('camera.falhouEnvio'), String(error));
    } finally {
      setUploading(false);
    }
  }, [printer, uploading]);

  const toggleLight = useCallback(() => {
    if (!printer || !isConnected) {
      return;
    }
    const next = !lightOn;
    setLightOn(next);
    setLastLightPress(Date.now());
    sendCommand(printer.id, {
      Id: `${printer.printerName}-light-${Date.now()}`,
      Data: {
        Cmd: LIGHT_COMMAND,
        Data: { LightStatus: { SecondLight: next ? 1 : 0 } },
        RequestID: `light-toggle-${Date.now()}`,
        MainboardID: '',
        TimeStamp: Date.now(),
        From: 1,
      },
    });
  }, [printer, isConnected, lightOn, sendCommand]);

  const streamHtml = useMemo(() => htmlDoVideo(videoHost ?? ''), [videoHost]);

  const fullscreenHtml = useMemo(
    () => htmlDoVideo(videoHost ?? '', 'contain'),
    [videoHost]
  );

  const progress = printer?.status?.PrintInfo?.Progress ?? 0;
  const nozzle = printer?.status?.TempOfNozzle?.toFixed(0) ?? '--';
  const bed = printer?.status?.TempOfHotbed?.toFixed(0) ?? '--';

  const info = printer?.status?.PrintInfo;
  const remainingSeconds = Math.max(
    0,
    Math.round((info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0))
  );
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMinutes = Math.round((remainingSeconds % 3600) / 60);
  const job =
    info && info.Filename
      ? {
          filename: info.Filename,
          layer: info.CurrentLayer ?? 0,
          totalLayers: info.TotalLayer ?? 0,
          remaining:
            remainingHours > 0
              ? `${remainingHours}h ${t('camera.minutos', { n: remainingMinutes })}`
              : t('camera.minutos', { n: remainingMinutes }),
        }
      : null;


  if (!printer) {
    return (
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-canvas items-center justify-center p-6"
      >
        <Ionicons name="videocam-off" size={48} color={hexDe(tema.paleta.tintaMuted)} />
        <Text className="mt-3 text-ink text-center">
          {t('camera.semImpressoras')}
        </Text>
        <TouchableOpacity
          className="mt-4 bg-brand rounded-xl px-6 py-3"
          onPress={() => navigation?.navigate('AddEditPrinter')}
        >
          <Text className="text-white font-bold">{t('camera.irParaImpressoras')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-canvas"
    >
      {/* Cabeçalho: voltar · CÂMARA · estado · recarregar */}
      <View className="flex-row items-center px-4 pt-1 pb-3">
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          className="w-8 h-8 -ml-1 mr-1 items-center justify-center"
          activeOpacity={0.7}
          accessibilityLabel={t('details.voltar')}
        >
          <Ionicons name="chevron-back" size={20} color={hexDe(tema.paleta.tinta)} />
        </TouchableOpacity>
        <Text className="text-[10px] tracking-[2.4px] font-semibold text-ink-soft">
          {t('camera.title').toUpperCase()}
        </Text>
        {isConnected && (
          <View className="flex-row items-center ml-2 bg-black/40 rounded-full px-2 py-1">
            <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
            <Text className="text-[8px] font-bold tracking-[1.2px] text-ink">
              {t('comum.emDireto').toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1" />
        <TouchableOpacity
          onPress={restartStream}
          className="w-8 h-8 items-center justify-center rounded-md border border-line"
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={15} color={hexDe(tema.paleta.tintaSoft)} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Selector de impressora */}
        {comCamera.length > 1 && (
          <View className="flex-row px-4 pb-3">
            {comCamera.map(p => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedId(p.id)}
                className={`rounded-md border px-3 py-1.5 mr-2 ${
                  p.id === printer.id ? 'border-brand bg-brand/10' : 'border-line'
                }`}
              >
                <Text
                  className={`text-[10px] font-semibold tracking-[1.2px] ${
                    p.id === printer.id ? 'text-brand-texto' : 'text-ink-soft'
                  }`}
                >
                  {p.printerName.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Vídeo 16:9 */}
        <View
          className="mx-4 rounded-2xl overflow-hidden bg-ink"
          style={{ flexGrow: 1, minHeight: 219, maxHeight: 460 }}
          onLayout={event => setVideoWidth(event.nativeEvent.layout.width)}
        >
          {isConnected && streamHtml && !fullscreen ? (
            <View ref={videoRef} collapsable={false} style={{ flex: 1 }}>
              {pouparDados && !snapshotFalhou ? (
                <SnapshotAoVivo host={videoHost ?? ''} activo={emFoco} onFalhar={() => setSnapshotFalhou(true)} />
              ) : (
              <WebView
                key={`${printer.id}-${reloadKey}`}
                ref={webViewRef}
                source={{ html: streamHtml, baseUrl: `http://${videoHost}` }}
                style={{ flex: 1, backgroundColor: '#000' }}
                javaScriptEnabled
                domStorageEnabled={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                mixedContentMode="always"
                originWhitelist={['*']}
                scrollEnabled={false}
                bounces={false}
              />
              )}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              {printer.connectionStatus === 'connecting' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="videocam-off" size={36} color="rgba(255,255,255,0.5)" />
              )}
              <Text className="text-white/60 mt-2 text-[11px] text-center px-4">
                {(printer.reconnectAttempt ?? 0) >= 2
                  ? t('camera.aReconectarTentativa', { n: printer.reconnectAttempt ?? 0 })
                  : printer.connectionStatus === 'connecting'
                    ? t('camera.aLigarImpressora')
                    : t(CONNECTION_LABEL[printer.connectionStatus])}
              </Text>
            </View>
          )}

          {/* Acções do vídeo */}
          {isConnected && streamHtml && (
            <View className="absolute top-2.5 right-2.5 flex-row">
              <TouchableOpacity
                onPress={() => setFullscreen(true)}
                className="w-8 h-8 rounded-full bg-black/55 items-center justify-center mr-2"
                accessibilityLabel={t('camera.ecraCheio')}
              >
                <Ionicons name="expand" size={15} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSnapshot}
                className="w-8 h-8 rounded-full bg-black/55 items-center justify-center"
                accessibilityLabel={t('camera.guardarFoto')}
              >
                <Ionicons name="camera-outline" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Barra de progresso colada à base */}
          {job && (
            <View className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15">
              <View
                className="h-full bg-brand"
                style={{ width: `${Math.max(2, progress)}%` }}
              />
            </View>
          )}
        </View>

        {/* Cartão de estado: o que a máquina está a fazer e o que podes fazer */}
        <View className="mx-4 mt-3 rounded-2xl border border-line bg-cartao px-4 py-3.5">
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: !isConnected
                  ? hexDe(tema.paleta.perigo)
                  : job
                    ? hexDe(tema.paleta.ok)
                    : hexDe(tema.paleta.tintaSoft),
              }}
            />
            <View className="flex-1 ml-2.5">
              <Text className="text-[13px] font-semibold text-ink">
                {!isConnected
                  ? t(CONNECTION_LABEL[printer.connectionStatus])
                  : job
                    ? t('camera.aImprimir')
                    : t('camera.pronta')}
              </Text>
              <Text className="text-[10px] text-ink-soft mt-0.5" numberOfLines={1}>
                {job
                  ? (job.filename.split('/').pop() ?? '').replace(/\.gcode$/i, '')
                  : t('camera.mesaLivre')}
              </Text>
              {job && (
                <Text className="text-[10px] text-ink-soft mt-0.5" numberOfLines={1}>
                  {`${t('comum.camada', {
                    actual: job.layer,
                    total: job.totalLayers,
                  })} · ${job.remaining}`}
                </Text>
              )}
            </View>

            {job && (
              <View
                style={{ width: CAIXA_ANEL, height: CAIXA_ANEL, alignItems: 'center', justifyContent: 'center' }}
              >
                <Svg width={CAIXA_ANEL} height={CAIXA_ANEL} style={{ position: 'absolute' }}>
                  <Circle
                    cx={CAIXA_ANEL / 2}
                    cy={CAIXA_ANEL / 2}
                    r={RAIO_ANEL}
                    stroke={hexDe(tema.paleta.linha)}
                    strokeWidth={TRACO_ANEL}
                    fill="none"
                  />
                  <Circle
                    cx={CAIXA_ANEL / 2}
                    cy={CAIXA_ANEL / 2}
                    r={RAIO_ANEL}
                    stroke={hexDe(tema.paleta.acento)}
                    strokeWidth={TRACO_ANEL}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * RAIO_ANEL}
                    strokeDashoffset={2 * Math.PI * RAIO_ANEL * (1 - Math.min(100, Math.max(0, progress)) / 100)}
                    transform={`rotate(-90 ${CAIXA_ANEL / 2} ${CAIXA_ANEL / 2})`}
                  />
                </Svg>
                <Text className="text-[10px] font-bold text-ink" style={{ fontFamily: 'monospace' }}>
                  {Math.round(progress)}%
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row mt-3" style={{ gap: 8 }}>
            {job ? (
              <>
                <TouchableOpacity
                  onPress={handlePrintControl}
                  className={`flex-1 h-11 rounded-xl items-center justify-center flex-row bg-brand border border-brand ${!isConnected ? 'opacity-40' : ''}`}
                  activeOpacity={0.8}
                  disabled={!isConnected}
                >
                  <Ionicons
                    name={isResumable(printer?.status?.PrintInfo?.Status ?? 0) ? 'play' : 'pause'}
                    size={13}
                    color="#FFFFFF"
                  />
                  <Text className="ml-1.5 text-[12px] font-semibold text-white">
                    {isResumable(printer?.status?.PrintInfo?.Status ?? 0)
                      ? t('comum.retomar')
                      : t('comum.pausar')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStopPrint}
                  className={`flex-1 h-11 rounded-xl items-center justify-center flex-row border border-state-danger ${!isConnected ? 'opacity-40' : ''}`}
                  activeOpacity={0.8}
                  disabled={!isConnected}
                >
                  <Ionicons name="stop" size={13} color={hexDe(tema.paleta.perigo)} />
                  <Text className="ml-1.5 text-[12px] font-semibold text-state-danger">
                    {t('comum.parar')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate('Files', { printerId: printer.id })}
                disabled={!isConnected}
                className={`flex-1 h-11 rounded-xl items-center justify-center flex-row bg-brand ${!isConnected ? 'opacity-40' : ''}`}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={13} color="#FFFFFF" />
                <Text className="ml-1.5 text-[12px] font-semibold text-white">
                  {t('camera.escolherFicheiro')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Térmica */}
        <View className="flex-row mx-4 mt-3" style={{ gap: 8 }}>
          {[
            { rotulo: t('comum.bico'), valor: `${nozzle}°`, alvo: printer.status?.TempTargetNozzle ?? 0, cor: hexDe(tema.paleta.aviso) },
            { rotulo: t('comum.mesa'), valor: `${bed}°`, alvo: printer.status?.TempTargetHotbed ?? 0, cor: hexDe(tema.paleta.acento) },
            {
              rotulo: t('comum.camara'),
              valor: `${printer.status?.TempOfBox?.toFixed(0) ?? '--'}°`,
              alvo: printer.status?.TempTargetBox ?? 0,
              cor: hexDe(tema.paleta.ok),
            },
          ].map(item => (
            <View
              key={item.rotulo}
              className="flex-1 rounded-xl border border-line bg-cartao px-3 py-2"
            >
              <Text className="text-[9px] font-semibold tracking-[0.6px] text-ink-soft">
                {item.rotulo.toUpperCase()}
              </Text>
              <View className="flex-row items-baseline mt-0.5">
                <Text className="text-[15px] font-bold" style={{ color: item.cor, fontFamily: 'monospace' }}>
                  {item.valor}
                </Text>
                <Text className="text-[10px] text-ink-soft ml-1" style={{ fontFamily: 'monospace' }}>
                  {item.alvo > 0 ? `/ ${Math.round(item.alvo)}°` : t('painel.ambiente')}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Ferramentas */}
        <View className="flex-row mx-4 mt-3" style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={toggleLight}
            disabled={!isConnected}
            className={`flex-1 h-14 rounded-xl border items-center justify-center ${
              lightOn ? 'border-state-light bg-state-light/15' : 'border-line bg-cartao'
            } ${!isConnected ? 'opacity-40' : ''}`}
            activeOpacity={0.75}
          >
            <Ionicons
              name={lightOn ? 'bulb' : 'bulb-outline'}
              size={17}
              color={lightOn ? hexDe(tema.paleta.aviso) : hexDe(tema.paleta.tintaSoft)}
            />
            <Text
              className={`text-[9px] font-semibold mt-1 ${lightOn ? 'text-state-light' : 'text-ink-soft'}`}
            >
              {lightOn ? t('camera.luzOn') : t('camera.luzOff')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFullscreen(true)}
            disabled={!isConnected}
            className={`flex-1 h-14 rounded-xl border border-line bg-cartao items-center justify-center ${!isConnected ? 'opacity-40' : ''}`}
            activeOpacity={0.75}
          >
            <Ionicons name="expand" size={17} color={hexDe(tema.paleta.tintaSoft)} />
            <Text className="text-[9px] font-semibold mt-1 text-ink-soft">{t('camera.ecraCheio')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSnapshot}
            disabled={!isConnected}
            className={`flex-1 h-14 rounded-xl border border-line bg-cartao items-center justify-center ${!isConnected ? 'opacity-40' : ''}`}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-outline" size={17} color={hexDe(tema.paleta.tintaSoft)} />
            <Text className="text-[9px] font-semibold mt-1 text-ink-soft">{t('camera.guardarFoto')}</Text>
          </TouchableOpacity>
        </View>

        {/* Enviar G-code */}
        <View className="mx-4 mt-3">
          {uploading && (
            <View className="absolute -top-1 left-0 right-0 h-1 rounded-full bg-line overflow-hidden">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, uploadPercent)}%` }}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading || !isConnected}
            className={`h-11 rounded-xl border border-line items-center justify-center flex-row ${uploading || !isConnected ? 'opacity-50' : ''}`}
            activeOpacity={0.75}
          >
            <Ionicons name="cloud-upload-outline" size={15} color={hexDe(tema.paleta.tintaSoft)} />
            <Text className="ml-2 text-[10px] font-semibold tracking-[1.2px] text-ink-soft">
              {(uploading ? t('camera.aEnviar', { p: uploadPercent }) : t('camera.enviarGcode')).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        supportedOrientations={['landscape', 'portrait']}
      >
        <View className="flex-1 bg-black">
          {pouparDados && !snapshotFalhou ? (
            <SnapshotAoVivo host={videoHost ?? ''} activo={emFoco} onFalhar={() => setSnapshotFalhou(true)} />
          ) : (
          <WebView
            source={{ html: fullscreenHtml, baseUrl: `http://${videoHost}` }}
            style={{ flex: 1, backgroundColor: '#000' }}
            javaScriptEnabled
            domStorageEnabled={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            originWhitelist={['*']}
            scrollEnabled={false}
            bounces={false}
          />
          )}

          <View className="absolute top-4 left-4 flex-row items-center bg-black/55 rounded-full px-3 py-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
            <Text className="text-white text-[10px] font-bold tracking-widest">
              {t('comum.emDiretoPct', { p: progress })}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setFullscreen(false)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-black/55 items-center justify-center"
          >
            <Ionicons name="contract" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
