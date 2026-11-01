import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Header } from '../../components/Header';
import { usePrinterConnections } from '../../contexts/PrinterConnectionsContext';
import { useGcodePreview } from '../../hooks/useGcodePreview';
import {
  listFilesCommand,
  fileDetailCommand,
  canvasSlotsCommand,
  startPrintCommand,
  deleteFilesCommand,
  descreverAck,
  ackDaResposta,
} from '../../utils/commands';
import { mensagemDeErro } from '../../utils/errors';
import { carregarInventario } from '../../utils/inventario';
import { verificarTodosOsSlots } from '../../utils/filamentos/verificacao';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { uploadGcode } from '../../utils/gcodeUpload';
import { slotValido } from '../../utils/slots';
import {
  extrairMiniaturaEmbutida,
  extrairMiniaturaEmbutidaFila,
  ferramentasUsadas,
  limparCacheMiniaturas,
  urlMiniatura,
} from '../../utils/miniatura';
import { duracaoDoNome, formatDuracao } from '../../utils/duracao';
import { descarregarGcode, partilharFicheiro } from '../../utils/transferir';
import { lerTimelapse } from '../../utils/timelapse';
import { t, useIdioma } from '../../i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import {
  BT_ACENTO,
  BT_APAGADA,
  BT_NEUTRA,
  BT_PERIGO,
  TX_ACENTO,
  TX_PERIGO,
} from '../../theme/botoes';

import { PrinterFile, formatSize } from './tipos';

export const FileRow = ({
  file,
  printerIp,
  onOpen,
  modo = 'lista',
  lado = 56,
  recarga = 0,
}: {
  file: PrinterFile;
  printerIp: string;
  onOpen: () => void;
  modo?: 'lista' | 'grelha';
  lado?: number;
  /** Muda quando o utilizador pede para recarregar: força nova tentativa. */
  recarga?: number;
}) => {
  const { tema } = useTheme();
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
  const label = file.name.split('/').pop() ?? file.name;
  // O `?r=` evita que o <Image> reaproveite o 404 em cache do mesmo URL.
  const urlBase = urlMiniatura(printerIp, file.name);
  const urlComToken = recarga ? `${urlBase}?r=${recarga}` : urlBase;
  const [mini, setMini] = useState<string | null>(urlComToken);
  const pediuEmbutida = useRef(false);
  const vivo = useRef(true);

  useEffect(() => {
    pediuEmbutida.current = false;
    setMini(urlComToken);
  }, [urlComToken]);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // A impressora só serve /thumbnail dos ficheiros que já pré-visualizou; nos
  // restantes (404) a imagem vem do cabeçalho do próprio .gcode. Sem isto a
  // lista mostrava o cubo e parecia que "só algumas miniaturas carregam".
  const falhouMiniaturaLista = async () => {
    if (pediuEmbutida.current) {
      if (vivo.current) setMini(null);
      return;
    }
    pediuEmbutida.current = true;
    const embutida = await extrairMiniaturaEmbutidaFila(printerIp, file.name);
    if (vivo.current) setMini(embutida);
  };

  const duracao = duracaoDoNome(file.name);
  const legenda = `${formatSize(size)}${duracao ? ` · ${formatDuracao(duracao)}` : ''}`;

  // Na grelha a miniatura manda: cartão quadrado, nome em duas linhas.
  if (modo === 'grelha') {
    return (
      <TouchableOpacity
        onPress={onOpen}
        activeOpacity={0.8}
        style={{ width: lado === 0 ? '100%' : lado === 1 ? '31.5%' : '48.5%' }}
        className="mb-3 rounded-xl bg-cartao border border-line overflow-hidden"
      >
        <View
          style={{ width: '100%', aspectRatio: lado === 0 ? 1.6 : 1 }}
          className="items-center justify-center bg-canvas-sunken"
        >
          {mini ? (
            <Image
              source={{ uri: mini }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={falhouMiniaturaLista}
            />
          ) : (
            <Ionicons
              name="cube-outline"
              size={22}
              color={hexDe(tema.paleta.tintaMuted)}
            />
          )}
        </View>
        <View className="p-2">
          <Text
            className="text-[11px] font-semibold text-ink"
            numberOfLines={2}
          >
            {label}
          </Text>
          <Text className="text-[10px] text-ink-muted mt-1">{legenda}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3 border-b border-line"
    >
      <View className="w-14 h-14 rounded-lg bg-cartao border border-line items-center justify-center overflow-hidden">
        {mini ? (
          <Image
            source={{ uri: mini }}
            style={{ width: 56, height: 56 }}
            resizeMode="cover"
            onError={falhouMiniaturaLista}
          />
        ) : (
          <Ionicons
            name="cube-outline"
            size={18}
            color={hexDe(tema.paleta.tintaMuted)}
          />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
          {label}
        </Text>
        <Text className="text-[11px] text-ink-muted mt-1">{legenda}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={hexDe(tema.paleta.tintaMuted)}
      />
    </TouchableOpacity>
  );
};
