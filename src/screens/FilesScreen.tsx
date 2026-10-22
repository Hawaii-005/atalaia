import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useGcodePreview } from '../hooks/useGcodePreview';
import {
  listFilesCommand,
  startPrintCommand,
  deleteFilesCommand,
  descreverAck,
  ackDaResposta,
} from '../utils/commands';
import { mensagemDeErro } from '../utils/errors';
import { t } from '../i18n';

interface PrinterFile {
  name: string;
  FileSize?: number;
  usedSize?: number;
  totalSize?: number;
}

const PREVIEW_LIMIT = 15 * 1024 * 1024;

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
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
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
      <View className="flex-1 ml-3">
        <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
          {label}
        </Text>
        <Text className="text-[11px] text-ink-muted mt-1">
          {formatSize(size)}
        </Text>
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
  // Só o id: o objeto do printer muda a cada actualização de estado (1 s) e
  // isso fazia o useFocusEffect recarregar a lista sem parar.
  const printerIdAtual = printer?.id;
  const [files, setFiles] = useState<PrinterFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bedLevel, setBedLevel] = useState(false);
  const [plateSide, setPlateSide] = useState<0 | 1>(0);

  const load = useCallback(async () => {
    if (!printerIdAtual) return;
    setLoading(true);
    setError(null);
    try {
      const data = await request(
        printerIdAtual,
        listFilesCommand('/local/', 1, 100)
      );
      const list: PrinterFile[] = data?.FileList ?? [];
      setFiles(
        list
          .filter(item => item.name?.toLowerCase().endsWith('.gcode'))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      setError(mensagemDeErro(e));
    } finally {
      setLoading(false);
    }
  }, [printerIdAtual, request]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePrint = (file: PrinterFile) => {
    const label = file.name.split('/').pop() ?? file.name;
    Alert.alert(t('files.imprimirTitulo'), t('files.imprimirMsg', { nome: label }), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('files.imprimirTitulo'),
        onPress: async () => {
          try {
            const comando = startPrintCommand(file.name, {
              nivelar: bedLevel,
              lado: plateSide,
            });
            const response = await request(printer.id, comando, 15000);
            const ack = ackDaResposta(response) ?? 0;
            if (ack !== 0) {
              Alert.alert(t('files.naoArrancou'), descreverAck(ack));
              return;
            }
            Alert.alert(t('files.aArrancar'), t('files.aArrancarMsg', { nome: label }));
            navigation.navigate('Printers');
          } catch (e) {
            Alert.alert(t('files.naoArrancou'), mensagemDeErro(e));
          }
        },
      },
    ]);
  };

  const handleDelete = (file: PrinterFile) => {
    const label = file.name.split('/').pop() ?? file.name;
    Alert.alert(t('files.apagarTitulo'), t('files.apagarMsg', { nome: label }), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('files.confirmarApagar'),
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await request(
              printer.id,
              deleteFilesCommand([file.name])
            );
            const ack = ackDaResposta(response) ?? 0;
            if (ack !== 0) {
              Alert.alert(t('files.naoApagou'), descreverAck(ack));
              // Recarrega: o estado real da lista pode ter mudado.
              load();
              return;
            }
            setFiles(prev => prev.filter(item => item.name !== file.name));
          } catch (e) {
            Alert.alert(t('files.naoApagou'), mensagemDeErro(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('files.title')}
        subtitle={printer ? printer.printerName : t('comum.semImpressora')}
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
          <Text className="text-[13px] text-ink-muted mt-3 text-center">
            {error}
          </Text>
          <TouchableOpacity
            onPress={load}
            className="mt-4 px-4 py-2 rounded-lg border border-line"
          >
            <Text className="text-[13px] font-semibold text-ink">
              {t('files.tentarDeNovo')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-semibold text-ink">
                {t('files.ladoMesa')}
              </Text>
              <Text className="text-[11px] text-ink-muted mt-0.5">
                {t('files.ladoMesaDica')}
              </Text>
            </View>
            <View className="flex-row">
              {([0, 1] as const).map(side => (
                <TouchableOpacity
                  key={side}
                  onPress={() => setPlateSide(side)}
                  activeOpacity={0.7}
                  className={`w-9 h-9 items-center justify-center rounded-lg mr-1.5 border ${
                    plateSide === side ? 'bg-brand border-brand' : 'border-line'
                  }`}
                >
                  <Text
                    className={`text-[13px] font-semibold ${
                      plateSide === side ? 'text-white' : 'text-ink-soft'
                    }`}
                  >
                    {side === 0 ? 'A' : 'B'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-semibold text-ink">
                {t('files.nivelarAntes')}
              </Text>
              <Text className="text-[11px] text-ink-muted mt-0.5">
                {t('files.nivelarDica')}
              </Text>
            </View>
            <Switch
              value={bedLevel}
              onValueChange={setBedLevel}
              trackColor={{ false: '#E4E4E4', true: '#3E6AE1' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E4E4E4"
            />
          </View>

          {files.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Ionicons name="folder-open-outline" size={36} color="#9AA0A6" />
              <Text className="text-[14px] font-semibold text-ink mt-3">
                {t('files.semFicheiros')}
              </Text>
              <Text className="text-[12px] text-ink-muted mt-1 text-center px-8">
                {t('files.semFicheirosDica')}
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
