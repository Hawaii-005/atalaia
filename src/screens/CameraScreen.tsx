import { enderecoDe } from '../utils/rede';
import { log } from '../utils/log';
import { mensagemDoErro } from '../utils/errors';
import { pausePrintCommand, stopPrintCommand } from '../utils/commands';
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
import Svg, { Path } from 'react-native-svg';
import { useGcodePreview } from '../hooks/useGcodePreview';
import * as DocumentPicker from 'expo-document-picker';
import { uploadGcode } from '../utils/gcodeUpload';
import { listFilesCommand } from '../utils/commands';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { Header } from '../components/Header';
import type { ConnectionStatus } from '../types';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { BT_ACENTO, BT_APAGADA, BT_NEUTRA, BT_PERIGO, TX_ACENTO, TX_PERIGO } from '../theme/botoes';

const LIGHT_COMMAND = 403;

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
const SnapshotAoVivo = ({ host, activo }: { host: string; activo: boolean }) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => setTick(valor => valor + 1), 2000);
    return () => clearInterval(id);
  }, [activo]);
  return (
    <Image
      source={{ uri: `http://${host}:3031/snapshot?t=${tick}` }}
      style={{ flex: 1, backgroundColor: '#000' }}
      resizeMode="cover"
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
  const emFoco = useIsFocused();
  const [fullscreen, setFullscreen] = useState(false);

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

  // Só este ecrã roda: ao abrir o modo cheio passa a horizontal e ao fechar
  // volta a portrait (a app está bloqueada em portrait no app.json).
  useEffect(() => {
    const lock = async () => {
      try {
        await ScreenOrientation.lockAsync(
          fullscreen
            ? ScreenOrientation.OrientationLock.LANDSCAPE
            : ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      } catch (error) {
        log('orientation lock failed', error);
      }
    };
    lock();
  }, [fullscreen]);

  useEffect(() => () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); }, []);

  const printer = useMemo(() => {
    const bySelection = printers.find(p => p.id === selectedId);
    if (bySelection) {
      return bySelection;
    }
    return (
      printers.find(p => p.connectionStatus === 'connected') ?? printers[0]
    );
  }, [printers, selectedId]);

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
        TimeStamp: Math.floor(Date.now() / 1000),
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
        TimeStamp: Math.floor(Date.now() / 1000),
        From: 1,
      },
    });
    setReloadKey(key => key + 1);
    webViewRef.current?.reload();
  }, [printerId, printerName, sendCommand, videoHost]);

  const handlePrintControl = useCallback(async () => {
    if (!printer) return;
    // Aqui só se pausa; retomar exige saber se os ticks pararam e isso vive
    // no ecrã de detalhe. O pedido espera pelo Ack: se a máquina recusar,
    // o utilizador sabe porquê.
    try {
      await request(printer.id, pausePrintCommand({ id: `pause-${Date.now()}` }));
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
        TimeStamp: 0,
        From: 1,
      },
    });
  }, [printer, isConnected, lightOn, sendCommand]);

  const [recentes, setRecentes] = useState<{ nome: string; tamanho: number }[]>([]);

  useEffect(() => {
    if (!isConnected || !printerId) return;
    let vivo = true;
    request(printerId, listFilesCommand('/local/', 1, 50))
      .then((dados: any) => {
        if (!vivo) return;
        const lista = (dados?.FileList ?? [])
          .filter((f: any) => String(f.name ?? '').toLowerCase().endsWith('.gcode'))
          .sort((a: any, b: any) => (b.CreateTime ?? 0) - (a.CreateTime ?? 0))
          .slice(0, 3);
        setRecentes(
          lista.map((f: any) => ({
            nome: String(f.name).split('/').pop() ?? '',
            tamanho: f.FileSize ?? 0,
          }))
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [isConnected, printerId, request]);

  const tamanhoLegivel = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  };

  const streamHtml = useMemo(() => {
    if (!videoHost) {
      return '';
    }
    const url = `http://${videoHost}:3031/video`;
    // A impressora aceita UMA ligação de vídeo de cada vez e não a liberta
    // depressa: qualquer ciclo de recarregamentos acaba em HTTP 500 e a câmara
    // só volta com um corte de corrente. Portanto: uma <img> carregada uma vez,
    // sem mensagens, e nova tentativa só se o browser der erro (com recuo).
    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
      img { width: 100%; height: 100%; object-fit: cover; display: block; }
    </style>
  </head>
  <body>
    <img id="v" src="${url}" />
    <script>
      (function () {
        var im = document.getElementById('v');
        var espera = 20000;
        var vivo = true;
        im.onload = function () { espera = 20000; };
        im.onerror = function () {
          if (!vivo) return;
          setTimeout(function () {
            if (vivo) im.src = '${url}?t=' + Date.now();
          }, espera);
          espera = Math.min(espera * 2, 60000);
        };
        window.addEventListener('pagehide', function () {
          vivo = false;
          im.removeAttribute('src');
        });
      })();
    </script>
  </body>
</html>`;
  }, [videoHost]);

  const fullscreenHtml = useMemo(() => {
    return streamHtml.replace('object-fit: cover', 'object-fit: contain');
  }, [streamHtml]);

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

  const { preview } = useGcodePreview(printer ? enderecoDe(printer) : undefined, job?.filename);

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
          onPress={() => navigation?.navigate('Printers')}
        >
          <Text className="text-white font-bold">{t('camera.irParaImpressoras')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      {/* Cabeçalho discreto: etiqueta + estado */}
      <View className="flex-row items-center justify-between px-4 pt-1 pb-3">
        <View className="flex-row items-center">
          <Text className="text-[10px] tracking-[2.4px] font-semibold text-ink-soft">
            {t('camera.title').toUpperCase()}
          </Text>
          <View
            className="w-1.5 h-1.5 rounded-full ml-2"
            style={{
              backgroundColor: isConnected
                ? hexDe(tema.paleta.ok)
                : hexDe(tema.paleta.perigo),
            }}
          />
        </View>
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
        {printers.length > 1 && (
          <View className="flex-row px-4 pb-3">
            {printers.map(p => (
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

        {/* Cartão de vídeo 16:9 */}
        <View
          className="mx-4 rounded-2xl overflow-hidden bg-ink"
          style={{ aspectRatio: 16 / 9 }}
          onLayout={event => setVideoWidth(event.nativeEvent.layout.width)}
        >
          {isConnected && streamHtml && !fullscreen ? (
            <View ref={videoRef} collapsable={false} style={{ flex: 1 }}>
              {pouparDados ? (
                <SnapshotAoVivo host={videoHost ?? ''} activo={emFoco} />
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

          {/* Etiqueta em direto */}
          {isConnected && (
            <View className="absolute top-2.5 left-2.5 bg-black/55 rounded-full px-2 py-1 flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
              <Text className="text-white text-[9px] font-bold tracking-[1.4px]">
                {t('comum.emDireto').toUpperCase()}
              </Text>
            </View>
          )}

          {/* Acções do vídeo */}
          {isConnected && streamHtml && (
            <View className="absolute top-2.5 right-2.5 flex-row">
              <TouchableOpacity
                onPress={() => setFullscreen(true)}
                className="w-8 h-8 rounded-full bg-black/55 items-center justify-center mr-2"
              >
                <Ionicons name="expand" size={15} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSnapshot}
                className="w-8 h-8 rounded-full bg-black/55 items-center justify-center"
              >
                <Ionicons name="camera-outline" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Rodapé do vídeo: camada e tempo restante */}
          {job && (
            <View className="absolute bottom-2 left-3 right-3 flex-row justify-between">
              <Text className="text-white text-[10px]">
                {t('comum.camada', { actual: job.layer, total: job.totalLayers })}
              </Text>
              <Text className="text-white text-[10px]">
                {t('camera.faltam', { tempo: job.remaining })}
              </Text>
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

        {/* Bico · Mesa · Luz */}
        <View className="flex-row items-center px-4 mt-3">
          <Text
            className="text-[11px] text-ink"
            style={{ fontFamily: 'monospace' }}
          >
            {t('comum.bico').toUpperCase()} {nozzle}°C
          </Text>
          <Text
            className="text-[11px] text-ink ml-4"
            style={{ fontFamily: 'monospace' }}
          >
            {t('comum.mesa').toUpperCase()} {bed}°C
          </Text>
          <View className="flex-1" />
          <TouchableOpacity
            onPress={toggleLight}
            disabled={!isConnected}
            className={`rounded-md border px-3 py-1.5 ${
              lightOn
                ? 'border-state-light bg-state-light/15'
                : 'border-line bg-canvas-sunken'
            } ${!isConnected ? 'opacity-40' : ''}`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-[10px] font-semibold tracking-[1.2px] ${
                lightOn ? 'text-state-light' : 'text-ink-soft'
              }`}
            >
              {lightOn ? t('camera.luzLigada') : t('camera.luzDesligada')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recentes */}
        <View className="px-4 mt-6">
          <Text className="text-[10px] tracking-[1.6px] font-semibold text-ink-soft">
            {t('camera.recentes').toUpperCase()}
          </Text>
          {recentes.length === 0 ? (
            <Text className="text-[11px] text-ink-muted mt-2">
              {t('camera.semFicheiros')}
            </Text>
          ) : (
            recentes.map((f, i) => (
              <View
                key={f.nome}
                className={`flex-row items-center py-2.5 ${
                  i === 0 ? 'border-t border-line mt-1' : ''
                } border-b border-line`}
              >
                <Text className="flex-1 text-[12px] text-ink" numberOfLines={1}>
                  {f.nome}
                </Text>
                <Text className="text-[11px] text-ink-muted ml-3">
                  {tamanhoLegivel(f.tamanho)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Estado quando não está a imprimir */}
        {!job && (
          <View className="mx-4 mt-5 rounded-xl border border-line px-4 py-3">
            <Text className="text-[10px] tracking-[1.4px] font-semibold text-ink-soft">
              {t('camera.inativa').toUpperCase()}
            </Text>
            <Text className="text-[12px] text-ink-muted mt-1">
              {t('camera.mesaLivre')}
            </Text>
          </View>
        )}

        {/* Pausa · Parar */}
        <View className="flex-row px-4 mt-6" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={handlePrintControl}
            disabled={!job}
            className={`flex-1 h-12 rounded-xl items-center justify-center border ${
              job ? 'bg-brand border-brand' : 'border-line'
            }`}
            activeOpacity={0.8}
          >
            <Text
              className={`text-[13px] font-semibold ${
                job ? 'text-white' : 'text-ink-muted'
              }`}
            >
              {printer?.status?.PrintInfo?.Status === 6
                ? t('comum.retomar')
                : t('comum.pausar')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStopPrint}
            disabled={!job}
            className={`flex-1 h-12 rounded-xl items-center justify-center border ${
              job ? 'border-state-danger' : 'border-line'
            }`}
            activeOpacity={0.8}
          >
            <Text
              className={`text-[13px] font-semibold ${
                job ? 'text-state-danger' : 'text-ink-muted'
              }`}
            >
              {t('comum.parar')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Enviar · Ficheiros */}
        <View className="flex-row px-4 mt-3">
          {uploading && (
            <View className="absolute -top-1 left-4 right-4 h-1 rounded-full bg-line overflow-hidden">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, uploadPercent)}%` }}
              />
            </View>
          )}
          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            className={`flex-1 ${BT_NEUTRA} h-10 mr-2 ${uploading ? 'opacity-60' : ''}`}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-upload-outline" size={15} color={hexDe(tema.paleta.tintaSoft)} />
            <Text className="ml-2 text-[10px] font-semibold tracking-[1.2px] text-ink-soft">
              {(uploading ? t('camera.aEnviar', { p: uploadPercent }) : t('camera.enviarGcode')).toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Printers', {
                screen: 'Files',
                params: { printerId: printer?.id },
              })
            }
            disabled={uploading}
            className={`flex-1 ${BT_NEUTRA} h-10 ${uploading ? 'opacity-60' : ''}`}
            activeOpacity={0.7}
          >
            <Ionicons name="folder-open-outline" size={15} color={hexDe(tema.paleta.tintaSoft)} />
            <Text className="ml-2 text-[10px] font-semibold tracking-[1.2px] text-ink-soft">
              {t('camera.ficheiros').toUpperCase()}
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
          {pouparDados ? (
            <SnapshotAoVivo host={videoHost ?? ''} activo={emFoco} />
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
