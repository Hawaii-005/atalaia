import { enderecoDe } from '../utils/rede';
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
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useGcodePreview } from '../hooks/useGcodePreview';
import {
  listFilesCommand,
  fileDetailCommand,
  canvasSlotsCommand,
  startPrintCommand,
  deleteFilesCommand,
  descreverAck,
  ackDaResposta,
} from '../utils/commands';
import { mensagemDeErro } from '../utils/errors';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { uploadGcode } from '../utils/gcodeUpload';
import { custoDe, euros, getPrecoKg, setPrecoKg } from '../utils/precos';
import { slotValido } from '../utils/slots';
import {
  extrairMiniaturaEmbutida,
  extrairMiniaturaEmbutidaFila,
  ferramentasUsadas,
  limparCacheMiniaturas,
  urlMiniatura,
} from '../utils/miniatura';
import { duracaoDoNome, formatDuracao } from '../utils/duracao';
import { descarregarGcode, partilharFicheiro } from '../utils/transferir';
import { lerTimelapse } from '../utils/timelapse';
import { t, useIdioma } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import {
  BT_ACENTO,
  BT_APAGADA,
  BT_NEUTRA,
  BT_PERIGO,
  TX_ACENTO,
  TX_PERIGO,
} from '../theme/botoes';
import { EstadoVazio } from '../ui/EstadoVazio';

interface PrinterFile {
  name: string;
  FileSize?: number;
  usedSize?: number;
  totalSize?: number;
  CreateTime?: number;
  TotalLayers?: number;
}

const PREVIEW_LIMIT = 15 * 1024 * 1024;

// O Cmd 260 é rápido, mas repetir o pedido a cada abertura do painel nota-se.
const cacheDetalhe = new Map<string, any>();

const formatTempo = (seg?: number) => {
  if (!seg || seg <= 0) return '';
  const h = Math.floor(seg / 3600);
  const m = Math.round((seg % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const FileRow = ({
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

const FileDetails = ({
  file,
  printerIp,
  printerId,
  bedLevel,
  onChangeBedLevel,
  plateSide,
  onChangePlateSide,
  onClose,
  onPrint,
  onAddToQueue,
  onDelete,
  onRename,
}: {
  file: PrinterFile;
  printerIp: string;
  printerId: string;
  bedLevel: boolean;
  onChangeBedLevel: (valor: boolean) => void;
  plateSide: 0 | 1;
  onChangePlateSide: (lado: 0 | 1) => void;
  onClose: () => void;
  onPrint: (slotMap: any[]) => void;
  onAddToQueue: () => void;
  onDelete: () => void;
  onRename: () => void;
}) => {
  useIdioma();
  const { tema } = useTheme();
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
  const { preview, filamentos, consumo, loading } = useGcodePreview(
    size && size < PREVIEW_LIMIT ? printerIp : undefined,
    file.name
  );
  const label = file.name.split('/').pop() ?? file.name;
  const { request } = usePrinterConnections();
  const [detalhe, setDetalhe] = useState<any>(null);
  const [slots, setSlots] = useState<Record<number, number>>({});
  const [trays, setTrays] = useState<any[]>([]);
  const [usadosGcode, setUsadosGcode] = useState<Set<number> | null>(null);

  // O cabeçalho do .gcode diz que ferramentas têm peso; vale mesmo para
  // ficheiros grandes, que não são descarregados para a pré-visualização.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const usados = await ferramentasUsadas(printerIp, file.name, size);
      if (vivo && usados) setUsadosGcode(usados);
    })();
    return () => {
      vivo = false;
    };
  }, [printerIp, file.name, size]);

  // Guardar no telemóvel: descarrega por HTTP e abre o menu do sistema.
  const [aGuardar, setAGuardar] = useState<number | null>(null);
  const guardar = async () => {
    setAGuardar(0);
    try {
      const { uri } = await descarregarGcode(printerIp, file.name, p =>
        setAGuardar(p)
      );
      setAGuardar(null);
      await partilharFicheiro(uri, file.name.split('/').pop() ?? file.name);
    } catch (e) {
      setAGuardar(null);
      Alert.alert(t('files.naoGuardou'), mensagemDeErro(e));
    }
  };

  // O fatiador declara sempre os 8 slots do AMS no Cmd 260, mesmo quando a peça
  // só usa um. Só contam as ferramentas com peso no cabeçalho do .gcode.
  const coresVisiveis = useMemo(() => {
    const mapa: any[] = detalhe?.ColorMapping ?? [];
    if (mapa.length === 0) return [] as { cor: any; indice: number }[];
    const usados =
      usadosGcode ?? new Set(filamentos.map(filamento => filamento.tool));
    if (usados.size > 0) {
      const filtradas = mapa
        .map((cor, indice) => ({ cor, indice }))
        .filter(({ indice }) => usados.has(indice));
      if (filtradas.length > 0) return filtradas;
    }
    // Antes de o .gcode estar lido, junta cores iguais para não mostrar 8 pretos.
    const vistos = new Set<string>();
    return mapa
      .map((cor, indice) => ({ cor, indice }))
      .filter(({ cor }) => {
        const chave = String(cor?.color ?? '').toLowerCase();
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
  }, [detalhe, filamentos, usadosGcode]);

  // Cores reais das bobines (Cmd 324): sem isto só se via a cor pedida pelo
  // ficheiro, não a que vai ser impressa.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const dados = await request(printerId, canvasSlotsCommand(), 10000);
        const lista = dados?.canvas_list?.[0]?.tray_list ?? [];
        if (vivo) setTrays(lista);
      } catch {
        // Sem CANVAS fica a cor do ficheiro.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [printerId, request]);

  const corDoSlot = (id: number) => {
    const tray = trays.find((t: any) => Number(t.tray_id) === Number(id));
    const cor = tray?.filament_color;
    return /^#[0-9a-f]{6}$/i.test(cor || '') ? cor : null;
  };
  const slotVazio = (id: number) => {
    const tray = trays.find((t: any) => Number(t.tray_id) === Number(id));
    return tray ? Number(tray.status) !== 1 : false;
  };
  const [mini, setMini] = useState<string | null>(
    urlMiniatura(printerIp, file.name)
  );
  const vivoRef = useRef(true);
  const pediuEmbutida = useRef(false);

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
    };
  }, []);

  const falhouMiniatura = async () => {
    if (!pediuEmbutida.current) {
      pediuEmbutida.current = true;
      const embutida = await extrairMiniaturaEmbutida(printerIp, file.name);
      if (vivoRef.current) setMini(embutida);
      return;
    }
    if (vivoRef.current) setMini(null);
  };
  const [precoKg, definirPrecoKg] = useState(0);
  const [precoTexto, definirPrecoTexto] = useState('');

  useEffect(() => {
    let vivo = true;
    const chave = `${printerId}|${file.name}`;
    const guardado = cacheDetalhe.get(chave);
    if (guardado) {
      setDetalhe(guardado);
      const mapaGuardado: Record<number, number> = {};
      (guardado.ColorMapping ?? []).forEach((cor: any, i: number) => {
        mapaGuardado[i] = slotValido(cor?.tray_id, i);
      });
      setSlots(mapaGuardado);
      return () => {
        vivo = false;
      };
    }
    (async () => {
      try {
        const dados = await request(
          printerId,
          fileDetailCommand(file.name),
          10000
        );
        const info = dados?.FileInfo;
        if (!vivo || !info) return;
        cacheDetalhe.set(chave, info);
        setDetalhe(info);
        const mapa: Record<number, number> = {};
        (info.ColorMapping ?? []).forEach((cor: any, i: number) => {
          mapa[i] = slotValido(cor?.tray_id, i);
        });
        setSlots(mapa);
      } catch {
        // Sem Cmd 260 fica o que vem do próprio G-code.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [printerId, file.name, request]);

  useEffect(() => {
    getPrecoKg().then(valor => {
      definirPrecoKg(valor);
      definirPrecoTexto(valor > 0 ? String(valor).replace('.', ',') : '');
    });
  }, []);

  const gramasDoCabecalho = filamentos.reduce((soma, f) => soma + f.gramas, 0);
  // Sem `filament used [g]` no cabeçalho, conta-se o E do próprio G-code.
  const gramasDetalhe = Number(detalhe?.EstWeight);
  const totalGramas =
    Number.isFinite(gramasDetalhe) && gramasDetalhe > 0
      ? gramasDetalhe
      : gramasDoCabecalho > 0
        ? gramasDoCabecalho
        : (consumo?.gramas ?? 0);
  // O valor escrito conta logo: não se espera que o campo perca o foco.
  const precoEscrito = Number.parseFloat(
    precoTexto.replace(',', '.').replace(/[^0-9.]/g, '')
  );
  const precoEfectivo = Number.isFinite(precoEscrito) ? precoEscrito : precoKg;
  const custo = custoDe(totalGramas, precoEfectivo);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      >
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
                <Text
                  className="text-[15px] font-bold text-ink"
                  numberOfLines={2}
                >
                  {label}
                </Text>
                <Text className="text-[12px] text-ink-muted mt-1">
                  {formatSize(size)}
                  {detalhe?.EstTime
                    ? ` · ${formatTempo(Number(detalhe.EstTime))}`
                    : ''}
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
                <Ionicons
                  name="close"
                  size={18}
                  color={hexDe(tema.paleta.tinta)}
                />
              </TouchableOpacity>
            </View>

            {/* Pré-visualização */}
            <View className="mt-3">
              {mini ? (
                <View
                  className="items-center justify-center"
                  style={{ height: 200 }}
                >
                  <Image
                    source={{ uri: mini }}
                    style={{ width: 200, height: 200 }}
                    resizeMode="contain"
                    onError={falhouMiniatura}
                  />
                </View>
              ) : loading ? (
                <View
                  className="items-center justify-center"
                  style={{ height: 200 }}
                >
                  <ActivityIndicator color={hexDe(tema.paleta.acento)} />
                </View>
              ) : preview ? (
                <View
                  className="items-center justify-center"
                  style={{ height: 200 }}
                >
                  <Svg viewBox="0 0 100 100" width={200} height={200}>
                    <Path
                      d={preview.path}
                      stroke={hexDe(tema.paleta.tinta)}
                      strokeWidth={0.45}
                      fill="none"
                    />
                  </Svg>
                </View>
              ) : (
                <View
                  className="items-center justify-center"
                  style={{ height: 200 }}
                >
                  <Ionicons
                    name="cube-outline"
                    size={40}
                    color={hexDe(tema.paleta.tintaMuted)}
                  />
                </View>
              )}
            </View>

            {/* Resumo em três células */}
            <View className="flex-row mt-3" style={{ gap: 8 }}>
              {[
                {
                  rotulo: t('files.total'),
                  valor:
                    totalGramas > 0
                      ? `${totalGramas.toFixed(1).replace('.', ',')} g`
                      : '—',
                },
                {
                  rotulo: t('files.custo'),
                  valor: custo > 0 ? `≈ ${euros(custo)}` : '—',
                },
                {
                  rotulo: t('files.filamentos'),
                  valor: String(coresVisiveis.length || filamentos.length || 0),
                },
              ].map(celula => (
                <View
                  key={celula.rotulo}
                  className="flex-1 border border-line rounded-md px-2.5 py-2"
                >
                  <Text className="text-[9px] tracking-[1.2px] font-semibold text-ink-soft">
                    {celula.rotulo.toUpperCase()}
                  </Text>
                  <Text
                    className="text-[15px] font-bold text-ink mt-0.5"
                    numberOfLines={1}
                  >
                    {celula.valor}
                  </Text>
                </View>
              ))}
            </View>

            {/* Filamentos */}
            <Text className="text-[10px] tracking-[1.4px] font-semibold text-ink-soft mt-5">
              {t('files.cores').toUpperCase()}
            </Text>
            {trays.length > 0 ? (
              <Text className="text-[9px] tracking-[1.2px] text-ink-soft mt-1">
                {t('files.corImpressa')}
              </Text>
            ) : null}
            {coresVisiveis.length > 0 ? (
              coresVisiveis.map(({ cor, indice: i }) => {
                const escolhido = slotValido(slots[i], i);
                const impressa = trays.length > 0 ? corDoSlot(escolhido) : null;
                return (
                  <View key={`cor-${i}`} className="mt-3">
                    <View className="flex-row items-center">
                      <View
                        className="w-4 h-4 rounded-full border border-line mr-2"
                        style={{
                          backgroundColor:
                            cor?.color ?? hexDe(tema.paleta.linha),
                        }}
                      />
                      <Text className="text-[12px] font-semibold text-ink">
                        T{i}
                      </Text>
                      <Text className="text-[12px] text-ink-muted ml-2">
                        {cor?.color ?? ''}
                      </Text>
                      {trays.length > 0 ? (
                        <>
                          <Text className="text-[12px] text-ink-soft mx-1.5">
                            →
                          </Text>
                          <View
                            className="w-4 h-4 rounded-full border border-line mr-1.5"
                            style={{
                              backgroundColor: impressa ?? 'transparent',
                            }}
                          />
                          <Text className="text-[12px] font-semibold text-ink">
                            A{escolhido + 1}
                          </Text>
                          <Text className="text-[12px] text-ink-muted ml-1">
                            {impressa ?? t('files.slotVazio')}
                          </Text>
                        </>
                      ) : null}
                    </View>
                    {trays.length > 0 ? (
                      <View className="flex-row mt-1.5" style={{ gap: 6 }}>
                        {[0, 1, 2, 3].map(tray => (
                          <TouchableOpacity
                            key={tray}
                            onPress={() =>
                              setSlots(anterior => ({ ...anterior, [i]: tray }))
                            }
                            activeOpacity={0.7}
                            className={`h-7 px-2 flex-row items-center rounded-md border ${
                              escolhido === tray
                                ? 'border-brand bg-brand/10'
                                : 'border-line'
                            }`}
                          >
                            <View
                              className="w-2 h-2 rounded-full mr-1"
                              style={{
                                backgroundColor: corDoSlot(tray) ?? '#555',
                              }}
                            />
                            <Text
                              className={`text-[10px] font-semibold ${
                                escolhido === tray
                                  ? 'text-ink'
                                  : 'text-ink-soft'
                              }`}
                            >
                              A{tray + 1}
                              {slotVazio(tray) ? '*' : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : !detalhe && loading ? (
              <View className="flex-row items-center mt-2">
                <ActivityIndicator
                  size="small"
                  color={hexDe(tema.paleta.acento)}
                />
                <Text className="text-[12px] text-ink-muted ml-2">
                  {t('files.aLer')}
                </Text>
              </View>
            ) : filamentos.length === 0 ? (
              <Text className="text-[12px] text-ink-muted mt-1.5">
                {t('files.coresNenhuma')}
              </Text>
            ) : (
              filamentos.map(filamento => (
                <View
                  key={filamento.tool}
                  className="flex-row items-center mt-2.5"
                >
                  <View
                    className="w-4 h-4 rounded-full border border-line mr-2"
                    style={{
                      backgroundColor:
                        filamento.cor ?? hexDe(tema.paleta.linha),
                    }}
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
                        plateSide === side
                          ? 'bg-brand border-brand'
                          : 'border-line'
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
                  trackColor={{
                    false: hexDe(tema.paleta.linha),
                    true: hexDe(tema.paleta.acento),
                  }}
                  thumbColor={hexDe(tema.paleta.tinta)}
                  ios_backgroundColor={hexDe(tema.paleta.linha)}
                />
              </View>
            </View>
          </ScrollView>

          {/* Acções fixas */}
          {aGuardar !== null && (
            <Text className="text-[11px] text-ink-muted px-4 pt-2">
              {t('files.aDescarregar', {
                pct: String(Math.round(aGuardar * 100)),
              })}
            </Text>
          )}
          <View
            className="flex-row items-center px-4 pt-3 border-t border-line"
            style={{ gap: 8, paddingBottom: 18 }}
          >
            <TouchableOpacity
              onPress={onRename}
              className="h-12 w-12 items-center justify-center rounded-md border-[1.5px] border-line bg-canvas-sunken"
              activeOpacity={0.7}
            >
              <Ionicons
                name="pencil-outline"
                size={18}
                color={hexDe(tema.paleta.tinta)}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={guardar}
              disabled={aGuardar !== null}
              accessibilityLabel={t('files.guardar')}
              className="h-12 w-12 items-center justify-center rounded-md border-[1.5px] border-line bg-canvas-sunken"
              activeOpacity={0.7}
              style={{ opacity: aGuardar !== null ? 0.6 : 1 }}
            >
              {aGuardar !== null ? (
                <ActivityIndicator
                  size="small"
                  color={hexDe(tema.paleta.tinta)}
                />
              ) : (
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={hexDe(tema.paleta.tinta)}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              className="h-12 w-12 items-center justify-center rounded-md border-[1.5px] border-line bg-canvas-sunken"
              activeOpacity={0.7}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={hexDe(tema.paleta.perigo)}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAddToQueue}
              accessibilityRole="button"
              accessibilityLabel={t('files.filaTitulo')}
              className="h-12 w-12 items-center justify-center rounded-md border-[1.5px] border-line bg-canvas-sunken"
              activeOpacity={0.7}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={hexDe(tema.paleta.tinta)}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                onPrint(
                  (detalhe?.ColorMapping ?? []).map((_: any, i: number) => ({
                    t: i,
                    canvas_id: 0,
                    tray_id: slotValido(slots[i], i),
                  }))
                )
              }
              className={`flex-1 h-12 ${BT_ACENTO}`}
              activeOpacity={0.8}
            >
              <Ionicons
                name="print-outline"
                size={16}
                color={hexDe(tema.paleta.acentoTexto)}
                style={{ marginRight: 8 }}
              />
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

export const FilesScreen = ({
  route,
  navigation,
  printerId: printerIdProp,
  embutido,
}: any) => {
  useIdioma();
  const { tema } = useTheme();
  const printerId = printerIdProp ?? route?.params?.printerId;
  const { printers, request, adicionarAFila } = usePrinterConnections();
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
  const [recarga, setRecarga] = useState(0);
  const [aRecarregar, setARecarregar] = useState(false);
  const [ordem, setOrdem] = useState<'nome' | 'data' | 'tamanho' | 'duracao'>(
    'nome'
  );
  const [crescente, setCrescente] = useState(true);
  const [procura, setProcura] = useState('');
  const [vista, setVista] = useState<'lista' | 'grelha'>('lista');
  const [tamanhoMini, setTamanhoMini] = useState<'p' | 'm' | 'g'>('m');

  // As escolhas de vista ficam guardadas, como no dashboard.
  useEffect(() => {
    AsyncStorage.getItem('atalaia.ficheiros.prefs')
      .then(bruto => {
        if (!bruto) return;
        const g = JSON.parse(bruto);
        if (g.vista === 'lista' || g.vista === 'grelha') setVista(g.vista);
        if (
          g.tamanhoMini === 'p' ||
          g.tamanhoMini === 'm' ||
          g.tamanhoMini === 'g'
        ) {
          setTamanhoMini(g.tamanhoMini);
        }
      })
      .catch(() => undefined);
  }, []);

  const escolherVista = (valor: 'lista' | 'grelha') => {
    setVista(valor);
    AsyncStorage.setItem(
      'atalaia.ficheiros.prefs',
      JSON.stringify({ vista: valor, tamanhoMini })
    ).catch(() => undefined);
  };

  const escolherTamanho = (valor: 'p' | 'm' | 'g') => {
    setTamanhoMini(valor);
    AsyncStorage.setItem(
      'atalaia.ficheiros.prefs',
      JSON.stringify({ vista, tamanhoMini: valor })
    ).catch(() => undefined);
  };
  const [aRenomear, setARenomear] = useState<PrinterFile | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  // O Cmd 258 é paginado (Page/Limit) e o firmware devolve no máximo 100 por
  // página: pedir só a página 1 escondia tudo o que passasse dos 100 ficheiros.
  const listarTodosOsFicheiros = useCallback(async () => {
    const PAGINA = 100;
    const MAX_PAGINAS = 20;
    const todos: PrinterFile[] = [];
    const vistos = new Set<string>();
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const dados = await request(
        printerIdAtual as string,
        listFilesCommand('/local/', pagina, PAGINA)
      );
      const lote: PrinterFile[] = dados?.FileList ?? [];
      for (const f of lote) {
        if (f.name && !vistos.has(f.name)) {
          vistos.add(f.name);
          todos.push(f);
        }
      }
      if (lote.length < PAGINA) break;
    }
    return todos;
  }, [printerIdAtual, request]);

  const load = useCallback(async () => {
    if (!printerIdAtual) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listarTodosOsFicheiros();
      setFiles(
        list.filter(item => item.name?.toLowerCase().endsWith('.gcode'))
      );
    } catch (e) {
      setError(mensagemDeErro(e));
    } finally {
      setLoading(false);
    }
  }, [printerIdAtual, listarTodosOsFicheiros]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visiveis = useMemo(() => {
    const termo = procura.trim().toLowerCase();
    const lista = files.filter(
      f =>
        !termo ||
        (f.name.split('/').pop() ?? f.name).toLowerCase().includes(termo)
    );
    if (ordem === 'duracao') {
      // Sem duração conhecida fica sempre no fim, cresça ou decresça.
      lista.sort((a, b) => {
        const da = duracaoDoNome(a.name);
        const db = duracaoDoNome(b.name);
        if (!da && !db) return a.name.localeCompare(b.name);
        if (!da) return 1;
        if (!db) return -1;
        return crescente ? da - db : db - da;
      });
      return lista;
    }
    lista.sort((a, b) => {
      if (ordem === 'data') return (a.CreateTime ?? 0) - (b.CreateTime ?? 0);
      if (ordem === 'tamanho') return (a.FileSize ?? 0) - (b.FileSize ?? 0);
      return a.name.localeCompare(b.name);
    });
    return crescente ? lista : lista.reverse();
  }, [files, ordem, crescente, procura]);

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
        `http://${enderecoDe(printer)}:3030${aRenomear.name}`,
        destino
      );
      if (descarga.status !== 200) throw new Error('descarga');
      await uploadGcode(enderecoDe(printer), destino, nomeFinal);
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

  const handlePrint = (file: PrinterFile, slotMap: any[] = []) => {
    const label = file.name.split('/').pop() ?? file.name;
    Alert.alert(
      t('files.imprimirTitulo'),
      t('files.imprimirMsg', { nome: label }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('files.imprimirTitulo'),
          onPress: async () => {
            try {
              const comando = startPrintCommand(file.name, {
                nivelar: bedLevel,
                lado: plateSide,
                slotMap,
                timelapse: (await lerTimelapse(printer.id)) ? 1 : 0,
              });
              const response = await request(printer.id, comando, 15000);
              const ack = ackDaResposta(response) ?? 0;
              if (ack !== 0) {
                Alert.alert(t('files.naoArrancou'), descreverAck(ack));
                return;
              }
              Alert.alert(
                t('files.aArrancar'),
                t('files.aArrancarMsg', { nome: label })
              );
              navigation.navigate('Impressora');
            } catch (e) {
              Alert.alert(t('files.naoArrancou'), mensagemDeErro(e));
            }
          },
        },
      ]
    );
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
      await uploadGcode(
        enderecoDe(printer),
        asset.uri,
        asset.name,
        (enviado, total) => {
          setOcupado(
            `${t('files.aEnviar')} ${Math.round((enviado / total) * 100)}%`
          );
        }
      );
      await load();
      Alert.alert(
        t('files.enviado'),
        t('files.enviadoMsg', { nome: asset.name }),
        [
          { text: t('comum.nao'), style: 'cancel' },
          {
            text: t('files.imprimirAgora'),
            onPress: async () => {
              try {
                // O nome tem de ser o que a máquina devolve no Cmd 258.
                const lista = await listarTodosOsFicheiros();
                const alvo = lista.find(f => f.name.endsWith(`/${asset.name}`));
                if (!alvo) {
                  Alert.alert(t('files.naoArrancou'), t('files.naoEncontrado'));
                  return;
                }
                const comando = startPrintCommand(alvo.name, {
                  nivelar: bedLevel,
                  lado: plateSide,
                  timelapse: (await lerTimelapse(printer.id)) ? 1 : 0,
                });
                const resposta = await request(printer.id, comando, 15000);
                const ack = ackDaResposta(resposta) ?? 0;
                if (ack !== 0) {
                  Alert.alert(t('files.naoArrancou'), descreverAck(ack));
                  return;
                }
                Alert.alert(
                  t('files.aArrancar'),
                  t('files.aArrancarMsg', { nome: asset.name })
                );
                navigation.navigate('Impressora');
              } catch (e) {
                Alert.alert(t('files.naoArrancou'), mensagemDeErro(e));
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(t('files.falhouEnvio'), mensagemDeErro(e));
    } finally {
      setOcupado(null);
    }
  }, [printer, load, bedLevel, plateSide, request, navigation]);

  const handleDelete = (file: PrinterFile) => {
    const label = file.name.split('/').pop() ?? file.name;
    Alert.alert(
      t('files.apagarTitulo'),
      t('files.apagarMsg', { nome: label }),
      [
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
      ]
    );
  };

  return (
    <SafeAreaView edges={embutido ? [] : ['top']} className="flex-1 bg-canvas">
      {!embutido && (
        <Header
          title={t('files.title')}
          subtitle={printer ? printer.printerName : t('comum.semImpressora')}
          onBack={() => navigation.goBack()}
          rightAction={{ icon: 'refresh', onPress: load }}
        />
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={hexDe(tema.paleta.acento)} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons
            name="alert-circle-outline"
            size={36}
            color={hexDe(tema.paleta.perigo)}
          />
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
              trackColor={{
                false: hexDe(tema.paleta.linha),
                true: hexDe(tema.paleta.acento),
              }}
              thumbColor={hexDe(tema.paleta.tinta)}
              ios_backgroundColor={hexDe(tema.paleta.linha)}
            />
          </View>

          <View className="px-4 pt-2 pb-2 border-b border-line">
            <View className="flex-row items-center rounded-lg border border-line bg-cartao px-2.5 h-10">
              <Ionicons
                name="search"
                size={15}
                color={hexDe(tema.paleta.tintaMuted)}
              />
              <TextInput
                value={procura}
                onChangeText={setProcura}
                placeholder={t('files.procurar')}
                placeholderTextColor={hexDe(tema.paleta.tintaMuted)}
                className="flex-1 ml-2 text-[13px] text-ink"
                autoCorrect={false}
                returnKeyType="search"
              />
              {procura.length > 0 && (
                <TouchableOpacity
                  onPress={() => setProcura('')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={hexDe(tema.paleta.tintaMuted)}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="flex-row items-center px-4 py-2 border-b border-line">
            <Text className="text-[12px] text-ink-muted mr-2">
              {t('files.ordenar')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-1"
            >
              {(['nome', 'data', 'tamanho', 'duracao'] as const).map(
                criterio => (
                  <TouchableOpacity
                    key={criterio}
                    onPress={() => setOrdem(criterio)}
                    activeOpacity={0.7}
                    className={`px-3 h-8 items-center justify-center rounded-lg mr-1.5 border ${
                      ordem === criterio
                        ? 'bg-brand border-brand'
                        : 'border-line'
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
                            : criterio === 'tamanho'
                              ? 'files.ordemTamanho'
                              : 'files.ordemDuracao'
                      )}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setCrescente(v => !v)}
              activeOpacity={0.7}
              className="w-8 h-8 items-center justify-center rounded-lg border border-line ml-1.5"
            >
              <Ionicons
                name={crescente ? 'arrow-up' : 'arrow-down'}
                size={15}
                color={hexDe(tema.paleta.tinta)}
              />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center px-4 py-2 border-b border-line">
            <View className="flex-row rounded-lg border border-line overflow-hidden">
              {(['lista', 'grelha'] as const).map(modo => (
                <TouchableOpacity
                  key={modo}
                  onPress={() => escolherVista(modo)}
                  activeOpacity={0.7}
                  className={`flex-row items-center px-3 h-8 ${
                    vista === modo ? 'bg-brand' : ''
                  }`}
                >
                  <Ionicons
                    name={modo === 'lista' ? 'list' : 'grid'}
                    size={14}
                    color={
                      vista === modo ? '#FFFFFF' : hexDe(tema.paleta.tintaSoft)
                    }
                  />
                  <Text
                    className={`text-[12px] font-semibold ml-1.5 ${
                      vista === modo ? 'text-white' : 'text-ink-soft'
                    }`}
                  >
                    {t(
                      modo === 'lista'
                        ? 'files.vistaLista'
                        : 'files.vistaGrelha'
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => {
                limparCacheMiniaturas();
                setRecarga(r => r + 1);
                setARecarregar(true);
                setTimeout(() => setARecarregar(false), 1500);
              }}
              activeOpacity={0.7}
              accessibilityLabel={t('files.recarregarMiniaturas')}
              style={{ marginLeft: 'auto' }}
              className="flex-row items-center h-8 px-2.5 rounded-lg border border-line"
            >
              <Ionicons
                name={aRecarregar ? 'sync' : 'refresh'}
                size={14}
                color={hexDe(tema.paleta.tintaSoft)}
              />
              <Text className="text-[12px] font-semibold text-ink-soft ml-1.5">
                {t('files.recarregarMiniaturas')}
              </Text>
            </TouchableOpacity>

            {vista === 'grelha' && (
              <View className="flex-row items-center ml-2">
                <Text className="text-[11px] text-ink-muted mr-1.5">
                  {t('files.miniatura')}
                </Text>
                {(['p', 'm', 'g'] as const).map(tam => (
                  <TouchableOpacity
                    key={tam}
                    onPress={() => escolherTamanho(tam)}
                    activeOpacity={0.7}
                    className={`w-8 h-8 items-center justify-center rounded-lg mr-1 border ${
                      tamanhoMini === tam
                        ? 'bg-brand border-brand'
                        : 'border-line'
                    }`}
                  >
                    <Text
                      className={`text-[12px] font-semibold ${
                        tamanhoMini === tam ? 'text-white' : 'text-ink-soft'
                      }`}
                    >
                      {tam.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {files.length === 0 ? (
            <View style={{ height: 380 }}>
              <EstadoVazio
                pose="ocioso"
                titulo={t('files.semFicheiros')}
                descricao={t('files.semFicheirosDica')}
                acaoPrimaria={{
                  rotulo: t('files.enviar'),
                  aoTocar: handleUpload,
                }}
              />
            </View>
          ) : visiveis.length === 0 ? (
            <View className="px-6 py-10 items-center">
              <Ionicons
                name="search"
                size={20}
                color={hexDe(tema.paleta.tintaMuted)}
              />
              <Text className="text-[13px] text-ink-muted mt-2 text-center">
                {t('files.semResultados', { q: procura.trim() })}
              </Text>
            </View>
          ) : vista === 'grelha' ? (
            <View className="flex-row flex-wrap justify-between px-3 pt-3">
              {visiveis.map(file => (
                <FileRow
                  key={file.name}
                  file={file}
                  printerIp={enderecoDe(printer)}
                  recarga={recarga}
                  modo="grelha"
                  lado={tamanhoMini === 'p' ? 1 : tamanhoMini === 'm' ? 2 : 0}
                  onOpen={() => setSelecionado(file)}
                />
              ))}
            </View>
          ) : (
            <View className="mt-2">
              {visiveis.map(file => (
                <FileRow
                  key={file.name}
                  file={file}
                  printerIp={enderecoDe(printer)}
                  recarga={recarga}
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
          printerIp={enderecoDe(printer)}
          printerId={printer.id}
          bedLevel={bedLevel}
          onChangeBedLevel={setBedLevel}
          plateSide={plateSide}
          onChangePlateSide={setPlateSide}
          onClose={() => setSelecionado(null)}
          onAddToQueue={() => {
            if (!printer) return;
            adicionarAFila({
              id: `${Date.now()}-${selecionado.name}`,
              printerId: printer.id,
              name: selecionado.name,
              label: selecionado.name.split('/').pop() ?? selecionado.name,
            });
            setSelecionado(null);
            Alert.alert(t('files.filaTitulo'), t('files.filaAdicionado'));
          }}
          onPrint={slotMap => {
            const alvo = selecionado;
            setSelecionado(null);
            handlePrint(alvo, slotMap);
          }}
          onRename={() => {
            const alvo = selecionado;
            setSelecionado(null);
            if (!alvo) return;
            setNovoNome(
              (alvo.name.split('/').pop() ?? '').replace(/\.gcode$/i, '')
            );
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
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={() => setARenomear(null)}
        >
          <View
            className="flex-1 items-center justify-center px-6"
            style={{ backgroundColor: 'rgba(23,26,32,0.45)' }}
          >
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
          <Ionicons
            name="cloud-upload-outline"
            size={16}
            color={hexDe(tema.paleta.acento)}
          />
          <Text className={`ml-2 text-[12px] font-semibold ${TX_ACENTO}`}>
            {ocupado ?? t('files.enviar')}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};
