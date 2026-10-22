import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  Pressable,
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
  onOpen,
}: {
  file: PrinterFile;
  printerIp: string;
  onOpen: () => void;
}) => {
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
  const { preview } = useGcodePreview(
    size && size < PREVIEW_LIMIT ? printerIp : undefined,
    file.name
  );
  const label = file.name.split('/').pop() ?? file.name;

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3 border-b border-line"
    >
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
      <Ionicons name="chevron-forward" size={18} color="#9AA0A6" />
    </TouchableOpacity>
  );
};

const FileDetails = ({
  file,
  printerIp,
  bedLevel,
  onChangeBedLevel,
  plateSide,
  onChangePlateSide,
  onClose,
  onPrint,
  onDelete,
}: {
  file: PrinterFile;
  printerIp: string;
  bedLevel: boolean;
  onChangeBedLevel: (valor: boolean) => void;
  plateSide: 0 | 1;
  onChangePlateSide: (lado: 0 | 1) => void;
  onClose: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) => {
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
  const { preview, filamentos, loading } = useGcodePreview(
    size && size < PREVIEW_LIMIT ? printerIp : undefined,
    file.name
  );
  const label = file.name.split('/').pop() ?? file.name;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(23,26,32,0.45)' }}>
        <View className="bg-canvas rounded-t-2xl px-4 pt-4 pb-6">
          <View className="flex-row items-start">
            <View className="flex-1 pr-3">
              <Text className="text-[15px] font-bold text-ink" numberOfLines={2}>
                {label}
              </Text>
              <Text className="text-[12px] text-ink-muted mt-1">
                {formatSize(size)}
                {filamentos.length > 1
                  ? ` · ${t('files.coresTotal', { n: filamentos.length })}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 items-center justify-center rounded-lg border border-line"
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#171A20" />
            </TouchableOpacity>
          </View>

          <View className="items-center justify-center mt-4 h-48 rounded-xl bg-white border border-line">
            {loading ? (
              <ActivityIndicator color="#3E6AE1" />
            ) : preview ? (
              <Svg viewBox="0 0 100 100" width={180} height={180}>
                <Path d={preview.path} stroke="#171A20" strokeWidth={0.5} fill="none" />
              </Svg>
            ) : (
              <Ionicons name="cube-outline" size={40} color="#9AA0A6" />
            )}
          </View>

          <View className="mt-4">
            <Text className="text-[12px] font-semibold text-ink">
              {t('files.cores')}
            </Text>
            {filamentos.length === 0 ? (
              <Text className="text-[12px] text-ink-muted mt-1">
                {t('files.coresNenhuma')}
              </Text>
            ) : (
              filamentos.map(filamento => (
                <View key={filamento.tool} className="flex-row items-center mt-2">
                  <View
                    className="w-5 h-5 rounded-full border border-line mr-2"
                    style={{ backgroundColor: filamento.cor ?? '#E4E4E4' }}
                  />
                  <Text className="text-[12px] font-semibold text-ink">
                    T{filamento.tool}
                  </Text>
                  <Text className="text-[12px] text-ink-muted ml-2">
                    {filamento.gramas.toFixed(2)} g
                    {filamento.tipo ? ` · ${filamento.tipo}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-line">
            <View className="flex-1 pr-3">
              <Text className="text-[12px] font-semibold text-ink">
                {t('files.ladoMesa')}
              </Text>
            </View>
            <View className="flex-row">
              {([0, 1] as const).map(side => (
                <TouchableOpacity
                  key={side}
                  onPress={() => onChangePlateSide(side)}
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

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-1 pr-3">
              <Text className="text-[12px] font-semibold text-ink">
                {t('files.nivelarAntes')}
              </Text>
              <Text className="text-[11px] text-ink-muted mt-0.5">
                {t('files.nivelarDica')}
              </Text>
            </View>
            <Switch
              value={bedLevel}
              onValueChange={onChangeBedLevel}
              trackColor={{ false: '#E4E4E4', true: '#3E6AE1' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E4E4E4"
            />
          </View>

          <View className="flex-row mt-5">
            <TouchableOpacity
              onPress={onDelete}
              className="h-12 px-4 items-center justify-center rounded-xl border border-line mr-2"
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#C62828" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPrint}
              className="flex-1 h-12 items-center justify-center rounded-xl bg-brand"
              activeOpacity={0.8}
            >
              <Text className="text-[14px] font-semibold text-white">
                {t('files.imprimirTitulo')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  const [selecionado, setSelecionado] = useState<PrinterFile | null>(null);

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
                  onOpen={() => setSelecionado(file)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {selecionado && (
        <FileDetails
          file={selecionado}
          printerIp={printer?.ipAddress ?? ''}
          bedLevel={bedLevel}
          onChangeBedLevel={setBedLevel}
          plateSide={plateSide}
          onChangePlateSide={setPlateSide}
          onClose={() => setSelecionado(null)}
          onPrint={() => {
            const alvo = selecionado;
            setSelecionado(null);
            handlePrint(alvo);
          }}
          onDelete={() => {
            const alvo = selecionado;
            setSelecionado(null);
            handleDelete(alvo);
          }}
        />
      )}
    </SafeAreaView>
  );
};
