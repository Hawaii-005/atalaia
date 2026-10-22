import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { Header } from '../components/Header';
import type { ConnectionStatus } from '../types';
import { t } from '../i18n';

const LIGHT_COMMAND = 403;

// Etiquetas visíveis para o estado de ligação da impressora (chaves i18n).
const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connected: 'camera.impLigada',
  connecting: 'camera.impALigar',
  disconnected: 'camera.impDesligada',
  error: 'camera.impComErro',
  timeout: 'camera.impSemResposta',
};

export const CameraScreen = ({ navigation, route }: any) => {
  // Keep the display awake while the camera tab is open.
  useKeepAwake();

  const { printers, sendCommand } = usePrinterConnections();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    route?.params?.printerId
  );
  const [lightOn, setLightOn] = useState(false);
  const [lastLightPress, setLastLightPress] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
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
        console.log('orientation lock failed', error);
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
  const videoHost = printer?.ipAddress;
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

  const handlePrintControl = useCallback(() => {
    if (!printer) return;
    const status = printer.status?.PrintInfo?.Status || 0;
    const cmd = status === 6 ? 131 : 129;
    sendCommand(printer.id, {
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
  }, [printer, sendCommand]);

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
  }, [printer, sendCommand]);

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
        printer.ipAddress,
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

  const streamHtml = useMemo(() => {
    if (!videoHost) {
      return '';
    }
    const url = `http://${videoHost}:3031/video`;
    // Lê o fluxo MJPEG com fetch (uma só ligação), extrai as tramas JPEG e
    // desenha-as num canvas com uma <img> temporária — createImageBitmap não
    // existe em WebViews antigas. A última trama fica à vista e a religação é
    // silenciosa: nada de "fluxo perdido".
    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
      canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      #hint { position: absolute; top: 10px; left: 0; right: 0; text-align: center; color: #9CA3AF;
              font: 12px -apple-system, Roboto, sans-serif; display: none; }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
    <div id="hint"></div>
    <script>
      (function () {
        var c = document.getElementById('c');
        var ctx = c.getContext('2d', { alpha: false });
        var hint = document.getElementById('hint');
        var url = '${url}';
        var vivo = true, ctrl = null, semTrama = null, primeira = false, ultimo = 0;

        function desenhar(bytes) {
          var blob = new Blob([bytes], { type: 'image/jpeg' });
          var endereco = URL.createObjectURL(blob);
          var im = new Image();
          im.onload = function () {
            if (c.width !== im.width || c.height !== im.height) {
              c.width = im.width;
              c.height = im.height;
            }
            ctx.drawImage(im, 0, 0, c.width, c.height);
            URL.revokeObjectURL(endereco);
            if (!primeira) { primeira = true; hint.style.display = 'none'; }
          };
          im.onerror = function () { URL.revokeObjectURL(endereco); };
          im.src = endereco;
        }

        function cortar() { try { if (ctrl) ctrl.abort(); } catch (e) {} }

        function vigiar() {
          clearTimeout(semTrama);
          semTrama = setTimeout(function () { cortar(); }, 6000);
        }

        async function ciclo() {
          if (!vivo) return;
          ctrl = new AbortController();
          vigiar();
          try {
            var res = await fetch(url + '?t=' + Date.now(), {
              signal: ctrl.signal,
              cache: 'no-store',
            });
            if (!res.body) throw new Error('sem corpo');
            var leitor = res.body.getReader();
            var resto = new Uint8Array(0);
            for (;;) {
              var r = await leitor.read();
              if (r.done) break;
              vigiar();
              var dados = new Uint8Array(resto.length + r.value.length);
              dados.set(resto, 0);
              dados.set(r.value, resto.length);
              resto = dados;

              var consumido = 0;
              for (;;) {
                var ini = -1, fim = -1, i, j;
                for (i = consumido; i < resto.length - 1; i += 1) {
                  if (resto[i] === 0xFF && resto[i + 1] === 0xD8) { ini = i; break; }
                }
                if (ini < 0) break;
                for (j = ini + 2; j < resto.length - 1; j += 1) {
                  if (resto[j] === 0xFF && resto[j + 1] === 0xD9) { fim = j + 2; break; }
                }
                if (fim < 0) { consumido = ini; break; }
                var agora = Date.now();
                if (agora - ultimo >= 70) {
                  ultimo = agora;
                  desenhar(resto.subarray(ini, fim));
                }
                consumido = fim;
              }
              resto = consumido > 0 ? resto.subarray(consumido) : resto;
              if (resto.length > 4194304) resto = new Uint8Array(0);
            }
          } catch (e) {
            // ligação cortada ou parada: volta a tentar em silêncio
          }
          clearTimeout(semTrama);
          if (vivo) setTimeout(ciclo, 700);
        }

        setTimeout(function () {
          if (!primeira) {
            hint.textContent = '${t('camera.hintALigar')}';
            hint.style.display = 'block';
          }
        }, 4000);

        window.addEventListener('pagehide', function () {
          vivo = false;
          clearTimeout(semTrama);
          cortar();
        });

        ciclo();
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

  const { preview } = useGcodePreview(printer?.ipAddress, job?.filename);

  if (!printer) {
    return (
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-canvas items-center justify-center p-6"
      >
        <Ionicons name="videocam-off" size={48} color="#7C8088" />
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
      <Header
        title={t('camera.title')}
        subtitle={
          isConnected ? t('camera.imagemEmDireto') : t('comum.impressoraDesligada')
        }
        rightAction={{ icon: 'refresh', onPress: restartStream }}
      />

      {/* Printer selector */}
      {printers.length > 1 && (
        <View className="flex-row px-4 pt-3">
          {printers.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelectedId(p.id)}
              className={`rounded-full px-3 py-1 mr-2 border ${
                p.id === printer.id
                  ? 'bg-brand border-brand'
                  : 'bg-canvas-sunken border-line'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  p.id === printer.id ? 'text-white' : 'text-ink-soft'
                }`}
              >
                {p.printerName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Video */}
      <View className="flex-1 px-4 pt-3">
        <View
          className="flex-1 rounded-xl2 overflow-hidden bg-ink"
          onLayout={event => setVideoWidth(event.nativeEvent.layout.width)}
        >
          {isConnected && streamHtml && !fullscreen ? (
            <View
              ref={videoRef}
              collapsable={false}
              style={
                capturing && videoWidth
                  ? {
                      width: videoWidth,
                      height: Math.round((videoWidth * 9) / 16),
                      alignSelf: 'center',
                    }
                  : { flex: 1 }
              }
            >
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
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              {printer.connectionStatus === 'connecting' ? (
                <ActivityIndicator color="#3E6AE1" />
              ) : (
                <Ionicons name="videocam-off" size={40} color="#7C8088" />
              )}
              <Text className="text-white/70 mt-2 text-sm text-center px-4">
                {(printer.reconnectAttempt ?? 0) >= 2
                  ? t('camera.aReconectarTentativa', { n: printer.reconnectAttempt ?? 0 })
                  : printer.connectionStatus === 'connecting'
                    ? t('camera.aLigarImpressora')
                    : t(CONNECTION_LABEL[printer.connectionStatus])}
              </Text>
            </View>
          )}

          {isConnected && streamHtml && (
            <TouchableOpacity
              onPress={handleSnapshot}
              className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/55 items-center justify-center"
            >
              <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {isConnected && streamHtml && (
            <TouchableOpacity
              onPress={() => setFullscreen(true)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 items-center justify-center"
            >
              <Ionicons name="expand" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {isConnected && (
            <View className="absolute top-3 left-3 bg-black/55 rounded-full px-2.5 py-1 flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
              <Text className="text-white text-[10px] font-bold tracking-widest">
                {t('comum.emDireto')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Controls */}
      <View className="px-4 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-lg font-bold text-ink">
              {printer.printerName}
            </Text>
            <Text className="text-xs text-ink-muted mt-0.5">
              {isConnected ? t('comum.ligada') : t('comum.desligada')} · {printer.ipAddress}
            </Text>
          </View>

          <TouchableOpacity
            onPress={toggleLight}
            disabled={!isConnected}
            className={`flex-row items-center rounded-xl px-4 py-3 ${
              lightOn ? 'bg-state-light' : 'bg-canvas-sunken border border-line'
            }`}
          >
            <Ionicons
              name={lightOn ? 'bulb' : 'bulb-outline'}
              size={20}
              color={lightOn ? '#171A20' : '#3F444D'}
            />
            <Text
              className={`ml-2 font-bold text-xs tracking-wide ${
                lightOn ? 'text-ink' : 'text-ink-soft'
              }`}
            >
              {lightOn ? t('camera.luzLigada') : t('camera.luzDesligada')}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row mt-4">
          <View className="flex-1 bg-canvas-sunken rounded-xl py-3 items-center mr-2">
            <Text className="text-[10px] tracking-widest text-ink-soft font-semibold">
              {t('comum.bico').toUpperCase()}
            </Text>
            <Text className="text-xl font-bold text-ink mt-1">
              {nozzle}
              <Text className="text-xs font-medium text-ink-muted"> °C</Text>
            </Text>
          </View>
          <View className="flex-1 bg-canvas-sunken rounded-xl py-3 items-center mr-2">
            <Text className="text-[10px] tracking-widest text-ink-soft font-semibold">
              {t('comum.mesa').toUpperCase()}
            </Text>
            <Text className="text-xl font-bold text-ink mt-1">
              {bed}
              <Text className="text-xs font-medium text-ink-muted"> °C</Text>
            </Text>
          </View>
          <View className="flex-1 bg-canvas-sunken rounded-xl py-3 items-center">
            <Text className="text-[10px] tracking-widest text-ink-soft font-semibold">
              {t('camera.progresso')}
            </Text>
            <Text className="text-xl font-bold text-ink mt-1">
              {progress > 0 ? `${progress}` : '—'}
              {progress > 0 && (
                <Text className="text-xs font-medium text-ink-muted"> %</Text>
              )}
            </Text>
          </View>
        </View>

        {/* Current job */}
        {job ? (
          <View className="mt-4 bg-canvas-sunken rounded-xl p-4">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[10px] tracking-widest text-ink-soft font-semibold"
                numberOfLines={1}
              >
                {t('comum.aImprimir').toUpperCase()}
              </Text>
              <Text className="text-xs text-ink-soft font-semibold">
                {job.remaining}
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              <View className="w-14 h-14 rounded-lg bg-white border border-line items-center justify-center overflow-hidden mr-3">
                {preview ? (
                  <Svg viewBox="0 0 100 100" width={52} height={52}>
                    <Path
                      d={preview.path}
                      stroke="#171A20"
                      strokeWidth={0.6}
                      fill="none"
                    />
                  </Svg>
                ) : (
                  <Ionicons name="cube-outline" size={18} color="#9AA0A6" />
                )}
              </View>
              <Text
                className="flex-1 text-sm font-semibold text-ink"
                numberOfLines={2}
              >
                {job.filename}
              </Text>
            </View>
            <View className="h-1.5 rounded-full bg-line mt-3 overflow-hidden">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, progress)}%` }}
              />
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-ink-muted">
                {t('comum.camada', { actual: job.layer, total: job.totalLayers })}
              </Text>
              <View className="flex-row">
                <TouchableOpacity
                  onPress={handlePrintControl}
                  className="px-3 py-1.5 rounded-lg border border-line mr-2"
                >
                  <Text className="text-[11px] font-semibold text-ink">
                    {printer?.status?.PrintInfo?.Status === 6
                      ? t('comum.retomar')
                      : t('comum.pausar')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStopPrint}
                  className="px-3 py-1.5 rounded-lg border border-line"
                >
                  <Text className="text-[11px] font-semibold text-[#C62828]">
                    {t('comum.parar')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View className="mt-4 bg-canvas-sunken rounded-xl p-4">
            <Text className="text-xs text-ink-soft font-semibold tracking-widest">
              {t('camera.inativa')}
            </Text>
            <Text className="text-sm text-ink-muted mt-1">
              {t('camera.mesaLivre')}
            </Text>
          </View>
        )}

        <View className="mt-3">
          {uploading && (
            <View className="h-1.5 rounded-full bg-line overflow-hidden mb-2 mx-0.5">
              <View
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max(2, uploadPercent)}%` }}
              />
            </View>
          )}
          <View className="flex-row">
            <TouchableOpacity
              onPress={handleUpload}
              disabled={uploading}
              className={`flex-1 rounded-xl border border-line py-3 items-center flex-row justify-center mr-2 ${
                uploading ? 'opacity-60' : ''
              }`}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#3F444D" />
              <Text className="ml-2 text-ink font-semibold text-[13px]">
                {uploading ? t('camera.aEnviar', { p: uploadPercent }) : t('camera.enviarGcode')}
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
              className={`flex-1 rounded-xl border border-line py-3 items-center flex-row justify-center ${
                uploading ? 'opacity-60' : ''
              }`}
              activeOpacity={0.7}
            >
              <Ionicons name="folder-open-outline" size={18} color="#3F444D" />
              <Text className="ml-2 text-ink font-semibold text-[13px]">{t('camera.ficheiros')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        supportedOrientations={['landscape', 'portrait']}
      >
        <View className="flex-1 bg-black">
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
