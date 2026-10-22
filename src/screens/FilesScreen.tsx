import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useGcodePreview } from '../hooks/useGcodePreview';

interface PrinterFile {
  name: string;
  usedSize?: number;
  totalSize?: number;
}

const PREVIEW_LIMIT = 15 * 1024 * 1024;

const PRINT_ACK: Record<number, string> = {
  1: 'A impressora está ocupada.',
  2: 'O ficheiro não existe na impressora.',
  3: 'O MD5 do ficheiro não confere.',
  4: 'A impressora não conseguiu abrir o ficheiro.',
  5: 'Resolução inválida para esta impressora.',
  6: 'Formato de ficheiro desconhecido.',
  7: 'Modelo desconhecido.',
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const FileRow = ({
  file,
  printerIp,
  onPrint,
  onDelete,
}: {
  file: PrinterFile;
  printerIp: string;
  onPrint?: () => void;
  onDelete: () => void;
}) => {
  const size = file.totalSize ?? file.usedSize ?? 0;
  const { preview } = useGcodePreview(
    size && size < PREVIEW_LIMIT ? printerIp : undefined,
    file.name
  );
  const label = file.name.split('/').pop() ?? file.name;

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-line">
      <View className="w-14 h-14 rounded-lg bg-white border border-line items-center justify-center overflow-hidden">
        {preview ? (
          <Svg viewBox="0 0 100 100" width={52} height={52}>
            <Path d={preview.path} stroke="#171A20" strokeWidth={0.6} fill="none" />
          </Svg>
        ) : (
          <Ionicons name="cube-outline" size={18} color="#9AA0A6" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
          {label}
        </Text>
        <Text className="text-[11px] text-ink-muted mt-1">{formatSize(size)}</Text>
      </View>
      <TouchableOpacity
        onPress={onPrint}
        className="w-9 h-9 items-center justify-center rounded-lg bg-brand-soft mr-1"
        activeOpacity={0.7}
      >
        <Ionicons name="play" size={16} color="#3E6AE1" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDelete}
        className="w-9 h-9 items-center justify-center rounded-lg"
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={17} color="#C62828" />
      </TouchableOpacity>
    </View>
  );
};

export const FilesScreen = ({ route, navigation }: any) => {
  const { printerId } = route.params ?? {};
  const { printers, request } = usePrinterConnections();
  const printer = printers.find(item => item.id === printerId) ?? printers[0];
  const [files, setFiles] = useState<PrinterFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!printer) return;
    setLoading(true);
    setError(null);
    try {
      const data = await request(printer.id, 258, { Url: '/local/', Page: 1, Limit: 100 });
      const list: PrinterFile[] = data?.FileList ?? [];
      setFiles(
        list
          .filter(item => item.name?.toLowerCase().endsWith('.gcode'))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [printer, request]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePrint = (file: PrinterFile) => {
    const label = file.name.split('/').pop() ?? file.name;
    Alert.alert('Imprimir', `Começar a imprimir ${label}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Imprimir',
        onPress: async () => {
          try {
            const response = await request(
              printer.id,
              128,
              {
                Filename: file.name,
                StartLayer: 0,
                Calibration_switch: 1,
                PrintPlatformType: 0,
                Tlp_Switch: 0,
                slot_map: [],
              },
              15000
            );
            const ack = Number(response?.Ack ?? 0);
            if (ack !== 0) {
              Alert.alert('Não arrancou', PRINT_ACK[ack] ?? `Código ${ack}`);
              return;
            }
            Alert.alert('A arrancar', `${label} vai começar.`);
            navigation.navigate('Printers');
          } catch (e) {
            Alert.alert('Não arrancou', String(e));
          }
        },
      },
    ]);
  };

  const handleDelete = (file: PrinterFile) => {
    const label = file.name.split('/').pop() ?? file.name;
    Alert.alert('Apagar', `Apagar ${label} da impressora?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await request(printer.id, 259, { FileList: [file.name], FolderList: [] });
            setFiles(prev => prev.filter(item => item.name !== file.name));
          } catch (e) {
            Alert.alert('Não apagou', String(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title="Ficheiros"
        subtitle={printer ? printer.printerName : 'Sem impressora'}
        onBack={() => navigation.goBack()}
        rightAction={{ icon: 'refresh', onPress: load }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3E6AE1" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={36} color="#C62828" />
          <Text className="text-[13px] text-ink-muted mt-3 text-center">{error}</Text>
          <TouchableOpacity onPress={load} className="mt-4 px-4 py-2 rounded-lg border border-line">
            <Text className="text-[13px] font-semibold text-ink">Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {files.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Ionicons name="folder-open-outline" size={36} color="#9AA0A6" />
              <Text className="text-[14px] font-semibold text-ink mt-3">
                Sem ficheiros na impressora
              </Text>
              <Text className="text-[12px] text-ink-muted mt-1 text-center px-8">
                Envia um G-code pelo ecrã da câmara.
              </Text>
            </View>
          ) : (
            <View className="mt-2">
              {files.map(file => (
                <FileRow
                  key={file.name}
                  file={file}
                  printerIp={printer?.ipAddress ?? ''}
                  onPrint={() => handlePrint(file)}
                  onDelete={() => handleDelete(file)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
