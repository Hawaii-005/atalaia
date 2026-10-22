import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import * as FileSystem from 'expo-file-system';
import { uploadGcode } from '../utils/gcodeUpload';
import { custoDe, euros, getPrecoKg, setPrecoKg } from '../utils/precos';
import { t } from '../i18n';

interface PrinterFile {
  name: string;
  FileSize?: number;
  usedSize?: number;
  totalSize?: number;
  CreateTime?: number;
  TotalLayers?: number;
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
  onRename,
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
  onRename: () => void;
}) => {
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
  const { preview, filamentos, loading } = useGcodePreview(
    size && size < PREVIEW_LIMIT ? printerIp : undefined,
    file.name
  );
  const label = file.name.split('/').pop() ?? file.name;
  const [precoKg, definirPrecoKg] = useState(0);
  const [precoTexto, definirPrecoTexto] = useState('');

  useEffect(() => {
    getPrecoKg().then(valor => {
      definirPrecoKg(valor);
      definirPrecoTexto(valor > 0 ? String(valor).replace('.', ',') : '');
    });
  }, []);

  const totalGramas = filamentos.reduce((soma, f) => soma + f.gramas, 0);
  const custo = custoDe(totalGramas, precoKg);

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
                  <Text className="text-[12px] text-ink-muted ml-2 flex-1">
                    {filamento.gramas.toFixed(2)} g
                    {filamento.tipo ? ` · ${filamento.tipo}` : ''}
                  </Text>
                  <Text className="text-[11px] text-ink-soft">
                    {t('files.slotSugerido', { slot: filamento.tool + 1 })}
                  </Text>
                </View>
              ))
            )}
            {filamentos.length > 0 && (
              <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-line">
                <Text className="text-[12px] text-ink-soft">
                  {t('files.total')}: {totalGramas.toFixed(1).replace('.', ',')} g
                </Text>
                <Text className="text-[12px] font-semibold text-ink">
                  {custo > 0 ? `≈ ${euros(custo)}` : '—'}
                </Text>
              </View>
            )}
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-[12px] text-ink-soft flex-1">
                {t('files.precoKg')}
              </Text>
              <TextInput
                value={precoTexto}
                onChangeText={definirPrecoTexto}
                onEndEditing={async () => {
                  const valor = Number.parseFloat(
                    precoTexto.replace(',', '.').replace(/[^0-9.]/g, '')
                  );
                  const limpo = Number.isFinite(valor) ? valor : 0;
                  definirPrecoKg(limpo);
                  await setPrecoKg(limpo);
                }}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor="#9AA0A6"
                className="w-24 h-9 px-3 rounded-lg border border-line text-[12px] text-ink text-right"
              />
            </View>
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
              onPress={onRename}
              className="h-12 w-12 items-center justify-center rounded-xl border border-line mr-2"
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={18} color="#171A20" />
            </TouchableOpacity>
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
  const [ordem, setOrdem] = useState<'nome' | 'data' | 'tamanho'>('nome');
  const [crescente, setCrescente] = useState(true);
  const [aRenomear, setARenomear] = useState<PrinterFile | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

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
      setFiles(list.filter(item => item.name?.toLowerCase().endsWith('.gcode')));
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

  const visiveis = useMemo(() => {
    const lista = [...files];
    lista.sort((a, b) => {
      if (ordem === 'data') return (a.CreateTime ?? 0) - (b.CreateTime ?? 0);
      if (ordem === 'tamanho') return (a.FileSize ?? 0) - (b.FileSize ?? 0);
      return a.name.localeCompare(b.name);
    });
    return crescente ? lista : lista.reverse();
  }, [files, ordem, crescente]);

  const handleRename = async () => {
    if (!aRenomear || !printer) return;
    const base = aRenomear.name.split('/').pop() ?? 'ficheiro.gcode';
    const escrito = novoNome.trim();
    if (!escrito) return;
    const nomeFinal = escrito.toLowerCase().endsWith('.gcode')
      ? escrito
      : `${escrito}.gcode`;
    const destino = `${FileSystem.cacheDirectory}rename_${Date.now()}_${base}`;
    setOcupado(t('files.aRenomear'));
    try {
      // A impressora não aceita renomear por comando: copia-se o ficheiro com
      // o nome novo e apaga-se o original.
      const descarga = await FileSystem.downloadAsync(
        `http://${printer.ipAddress}:3030${aRenomear.name}`,
        destino
      );
      if (descarga.status !== 200) throw new Error('descarga');
      await uploadGcode(printer.ipAddress, destino, nomeFinal);
      await request(printer.id, deleteFilesCommand([aRenomear.name]), 12000);
      setARenomear(null);
      await load();
      Alert.alert(t('files.renomearTitulo'), t('files.renomearFeito'));
    } catch (e) {
      Alert.alert(
        t('files.renomearTitulo'),
        `${t('files.renomearFalhou')} ${mensagemDeErro(e)}`
      );
    } finally {
      FileSystem.deleteAsync(destino, { idempotent: true }).catch(() => {});
      setOcupado(null);
    }
  };

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

          <View className="flex-row items-center px-4 py-2 border-b border-line">
            <Text className="text-[12px] text-ink-muted mr-2">
              {t('files.ordenar')}
            </Text>
            {(['nome', 'data', 'tamanho'] as const).map(criterio => (
              <TouchableOpacity
                key={criterio}
                onPress={() => setOrdem(criterio)}
                activeOpacity={0.7}
                className={`px-3 h-8 items-center justify-center rounded-lg mr-1.5 border ${
                  ordem === criterio ? 'bg-brand border-brand' : 'border-line'
                }`}
              >
                <Text
                  className={`text-[12px] font-semibold ${
                    ordem === criterio ? 'text-white' : 'text-ink-soft'
                  }`}
                >
                  {t(
                    criterio === 'nome'
                      ? 'files.ordemNome'
                      : criterio === 'data'
                      ? 'files.ordemData'
                      : 'files.ordemTamanho'
                  )}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setCrescente(v => !v)}
              activeOpacity={0.7}
              className="w-8 h-8 items-center justify-center rounded-lg border border-line ml-auto"
            >
              <Ionicons
                name={crescente ? 'arrow-up' : 'arrow-down'}
                size={15}
                color="#171A20"
              />
            </TouchableOpacity>
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
              {visiveis.map(file => (
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
          onRename={() => {
            const alvo = selecionado;
            setSelecionado(null);
            if (!alvo) return;
            setNovoNome((alvo.name.split('/').pop() ?? '').replace(/\.gcode$/i, ''));
            setARenomear(alvo);
          }}
          onDelete={() => {
            const alvo = selecionado;
            setSelecionado(null);
            handleDelete(alvo);
          }}
        />
      )}
      {aRenomear && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setARenomear(null)}>
          <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(23,26,32,0.45)' }}>
            <View className="w-full bg-canvas rounded-2xl p-4">
              <Text className="text-[15px] font-bold text-ink">
                {t('files.renomearTitulo')}
              </Text>
              <Text className="text-[12px] text-ink-muted mt-1">
                {t('files.renomearMsg')}
              </Text>
              <TextInput
                value={novoNome}
                onChangeText={setNovoNome}
                autoFocus
                className="h-11 px-3 mt-3 rounded-xl border border-line text-[13px] text-ink"
                placeholder={t('files.nomeNovo')}
                placeholderTextColor="#9AA0A6"
              />
              <View className="flex-row justify-end mt-4">
                <TouchableOpacity
                  onPress={() => setARenomear(null)}
                  className="px-4 h-10 items-center justify-center rounded-xl border border-line mr-2"
                  activeOpacity={0.7}
                >
                  <Text className="text-[13px] font-semibold text-ink">
                    {t('comum.cancelar')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRename}
                  disabled={!!ocupado || !novoNome.trim()}
                  className={`px-4 h-10 items-center justify-center rounded-xl ${
                    ocupado || !novoNome.trim() ? 'bg-line' : 'bg-brand'
                  }`}
                  activeOpacity={0.8}
                >
                  <Text className="text-[13px] font-semibold text-white">
                    {ocupado ?? t('files.renomear')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};
