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
import * as DocumentPicker from 'expo-document-picker';
import { uploadGcode } from '../utils/gcodeUpload';
import { custoDe, euros, getPrecoKg, setPrecoKg } from '../utils/precos';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { BT_ACENTO, BT_APAGADA, BT_NEUTRA, BT_PERIGO, TX_ACENTO, TX_PERIGO } from '../theme/botoes';

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
  const { tema } = useTheme();
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
      <View className="w-14 h-14 rounded-lg bg-cartao border border-line items-center justify-center overflow-hidden">
        {preview ? (
          <Svg viewBox="0 0 100 100" width={52} height={52}>
            <Path
              d={preview.path}
              stroke={hexDe(tema.paleta.tinta)}
              strokeWidth={0.6}
              fill="none"
            />
          </Svg>
        ) : (
          <Ionicons name="cube-outline" size={18} color={hexDe(tema.paleta.tintaMuted)} />
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
      <Ionicons name="chevron-forward" size={18} color={hexDe(tema.paleta.tintaMuted)} />
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
  const { tema } = useTheme();
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
  // O valor escrito conta logo: não se espera que o campo perca o foco.
  const precoEscrito = Number.parseFloat(
    precoTexto.replace(',', '.').replace(/[^0-9.]/g, '')
  );
  const precoEfectivo = Number.isFinite(precoEscrito)
    ? precoEscrito
    : precoKg;
  const custo = custoDe(totalGramas, precoEfectivo);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View className="bg-canvas rounded-t-2xl" style={{ maxHeight: '92%' }}>
          <View className="items-center pt-2.5 pb-1">
            <View className="w-10 h-1 rounded-full bg-line" />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Cabeçalho */}
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
                <Ionicons name="close" size={18} color={hexDe(tema.paleta.tinta)} />
              </TouchableOpacity>
            </View>

            {/* Pré-visualização */}
            <View className="mt-3">
              {loading ? (
                <View className="items-center justify-center" style={{ height: 200 }}>
                  <ActivityIndicator color={hexDe(tema.paleta.acento)} />
                </View>
              ) : preview ? (
                <View className="items-center justify-center" style={{ height: 200 }}>
                  <Svg viewBox="0 0 100 100" width={200} height={200}>
                    <Path d={preview.path} stroke={hexDe(tema.paleta.tinta)} strokeWidth={0.45} fill="none" />
                  </Svg>
                </View>
              ) : (
                <View className="items-center justify-center" style={{ height: 200 }}>
                  <Ionicons name="cube-outline" size={40} color={hexDe(tema.paleta.tintaMuted)} />
                </View>
              )}
            </View>

            {/* Resumo em três células */}
            <View className="flex-row mt-3" style={{ gap: 8 }}>
              {[
                { rotulo: t('files.total'), valor: `${totalGramas.toFixed(1).replace('.', ',')} g` },
                { rotulo: t('files.custo'), valor: custo > 0 ? `≈ ${euros(custo)}` : '—' },
                {
                  rotulo: t('files.filamentos'),
                  valor: String(filamentos.length || 0),
                },
              ].map(celula => (
                <View
                  key={celula.rotulo}
                  className="flex-1 border border-line rounded-md px-2.5 py-2"
                >
                  <Text className="text-[9px] tracking-[1.2px] font-semibold text-ink-soft">
                    {celula.rotulo.toUpperCase()}
                  </Text>
                  <Text className="text-[15px] font-bold text-ink mt-0.5" numberOfLines={1}>
                    {celula.valor}
                  </Text>
                </View>
              ))}
            </View>

            {/* Filamentos */}
            <Text className="text-[10px] tracking-[1.4px] font-semibold text-ink-soft mt-5">
              {t('files.cores').toUpperCase()}
            </Text>
            {filamentos.length === 0 ? (
              <Text className="text-[12px] text-ink-muted mt-1.5">
                {t('files.coresNenhuma')}
              </Text>
            ) : (
              filamentos.map(filamento => (
                <View key={filamento.tool} className="flex-row items-center mt-2.5">
                  <View
                    className="w-4 h-4 rounded-full border border-line mr-2"
                    style={{ backgroundColor: filamento.cor ?? hexDe(tema.paleta.linha) }}
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

            {/* Preço por quilo */}
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-line">
              <Text className="text-[12px] text-ink-soft flex-1">
                {t('files.precoKg')}
              </Text>
              <TextInput
                value={precoTexto}
                onChangeText={texto => {
                  definirPrecoTexto(texto);
                  const valor = Number.parseFloat(
                    texto.replace(',', '.').replace(/[^0-9.]/g, '')
                  );
                  if (Number.isFinite(valor)) definirPrecoKg(valor);
                }}
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
                placeholderTextColor={hexDe(tema.paleta.tintaMuted)}
                className="w-24 h-9 px-3 rounded-lg border border-line text-[12px] text-ink text-right"
              />
            </View>

            {/* Impressão */}
            <Text className="text-[10px] tracking-[1.4px] font-semibold text-ink-soft mt-5">
              {t('files.impressao').toUpperCase()}
            </Text>
            <View className="border border-line rounded-md mt-2">
              <View className="flex-row items-center justify-between px-3 py-2.5">
                <Text className="text-[12px] text-ink flex-1">
                  {t('files.ladoMesa')}
                </Text>
                <View className="flex-row">
                  {([0, 1] as const).map(side => (
                    <TouchableOpacity
                      key={side}
                      onPress={() => onChangePlateSide(side)}
                      activeOpacity={0.7}
                      className={`w-9 h-8 items-center justify-center rounded-md mr-1.5 border ${
                        plateSide === side ? 'bg-brand border-brand' : 'border-line'
                      }`}
                    >
                      <Text
                        className={`text-[12px] font-semibold ${
                          plateSide === side ? 'text-white' : 'text-ink-soft'
                        }`}
                      >
                        {side === 0 ? 'A' : 'B'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="flex-row items-center justify-between px-3 py-2.5 border-t border-line">
                <View className="flex-1 pr-3">
                  <Text className="text-[12px] text-ink">
                    {t('files.nivelarAntes')}
                  </Text>
                  <Text className="text-[10px] text-ink-muted mt-0.5">
                    {t('files.nivelarDica')}
                  </Text>
                </View>
                <Switch
                  value={bedLevel}
                  onValueChange={onChangeBedLevel}
                  trackColor={{ false: hexDe(tema.paleta.linha), true: hexDe(tema.paleta.acento) }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={hexDe(tema.paleta.linha)}
                />
              </View>
            </View>
          </ScrollView>

          {/* Acções fixas */}
          <View
            className="flex-row items-center px-4 pt-3 border-t border-line"
            style={{ gap: 8, paddingBottom: 18 }}
          >
            <TouchableOpacity
              onPress={onRename}
              className="h-12 w-12 items-center justify-center rounded-md border-[1.5px] border-line bg-canvas-sunken"
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={18} color={hexDe(tema.paleta.tinta)} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              className="h-12 w-12 items-center justify-center rounded-md border-[1.5px] border-line bg-canvas-sunken"
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={hexDe(tema.paleta.perigo)} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onPrint}
              className={`flex-1 h-12 ${BT_ACENTO}`}
              activeOpacity={0.8}
            >
              <Ionicons name="print-outline" size={16} color={hexDe(tema.paleta.acentoTexto)} style={{ marginRight: 8 }} />
              <Text className={`text-[12px] ${TX_ACENTO}`}>
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
  const { tema } = useTheme();
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

  /** Envia um G-code do telemóvel e oferece imprimir logo a seguir. */
  const handleUpload = useCallback(async () => {
    if (!printer) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    try {
      setOcupado(`${t('files.aEnviar')} 0%`);
      await uploadGcode(printer.ipAddress, asset.uri, asset.name, (enviado, total) => {
        setOcupado(`${t('files.aEnviar')} ${Math.round((enviado / total) * 100)}%`);
      });
      await load();
      Alert.alert(t('files.enviado'), t('files.enviadoMsg', { nome: asset.name }), [
        { text: t('comum.nao'), style: 'cancel' },
        {
          text: t('files.imprimirAgora'),
          onPress: async () => {
            try {
              // O nome tem de ser o que a máquina devolve no Cmd 258.
              const dados = await request(
                printer.id,
                listFilesCommand('/local/', 1, 100)
              );
              const lista: PrinterFile[] = dados?.FileList ?? [];
              const alvo = lista.find(f => f.name.endsWith(`/${asset.name}`));
              if (!alvo) {
                Alert.alert(t('files.naoArrancou'), t('files.naoEncontrado'));
                return;
              }
              const comando = startPrintCommand(alvo.name, {
                nivelar: bedLevel,
                lado: plateSide,
              });
              const resposta = await request(printer.id, comando, 15000);
              const ack = ackDaResposta(resposta) ?? 0;
              if (ack !== 0) {
                Alert.alert(t('files.naoArrancou'), descreverAck(ack));
                return;
              }
              Alert.alert(t('files.aArrancar'), t('files.aArrancarMsg', { nome: asset.name }));
              navigation.navigate('Printers');
            } catch (e) {
              Alert.alert(t('files.naoArrancou'), mensagemDeErro(e));
            }
          },
        },
      ]);
    } catch (e) {
      Alert.alert(t('files.falhouEnvio'), mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }, [printer, load, bedLevel, plateSide, request, navigation]);

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
          <ActivityIndicator color={hexDe(tema.paleta.acento)} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={36} color={hexDe(tema.paleta.perigo)} />
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
              trackColor={{ false: hexDe(tema.paleta.linha), true: hexDe(tema.paleta.acento) }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={hexDe(tema.paleta.linha)}
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
                color={hexDe(tema.paleta.tinta)}
              />
            </TouchableOpacity>
          </View>

          {files.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Ionicons name="folder-open-outline" size={36} color={hexDe(tema.paleta.tintaMuted)} />
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
                placeholderTextColor={hexDe(tema.paleta.tintaMuted)}
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
                  className={`px-4 h-10 ${
                    ocupado || !novoNome.trim() ? BT_APAGADA : BT_ACENTO
                  }`}
                  activeOpacity={0.8}
                >
                  <Text className={`text-[13px] ${TX_ACENTO}`}>
                    {ocupado ?? t('files.renomear')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {!loading && printer && (
        <TouchableOpacity
          onPress={handleUpload}
          disabled={!!ocupado}
          activeOpacity={0.85}
          className={`absolute right-5 bottom-7 ${BT_ACENTO} px-4 py-3 rounded-full flex-row items-center`}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={hexDe(tema.paleta.acento)} />
          <Text className={`ml-2 text-[12px] font-semibold ${TX_ACENTO}`}>
            {ocupado ?? t('files.enviar')}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};
