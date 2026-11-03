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

import {
  PREVIEW_LIMIT,
  PrinterFile,
  cacheDetalhe,
  formatSize,
  formatTempo,
} from './tipos';
import { Camadas } from './Camadas';

export const DetalheFicheiro = ({
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
  favorito,
  onAlternarFavorito,
  reimpressoes,
  ultimaImpressao,
  painel = false,
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
  favorito: boolean;
  onAlternarFavorito: () => void;
  reimpressoes: number;
  ultimaImpressao?: string;
  /** No tablet desenha-se como painel lateral, sem modal nem fundo escuro. */
  painel?: boolean;
}) => {
  useIdioma();
  const { tema } = useTheme();
  const [aVerCamadas, setAVerCamadas] = useState(false);
  const size = file.FileSize ?? file.totalSize ?? file.usedSize ?? 0;
  const { preview, filamentos, consumo, loading } = useGcodePreview(
    size && size < PREVIEW_LIMIT ? printerIp : undefined,
    file.name
  );
  const label = file.name.split('/').pop() ?? file.name;
  const { request, printers } = usePrinterConnections();
  const printer = printers.find(p => p.id === printerId);
  const isMoonraker = printer?.firmware === 'moonraker';
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
    urlMiniatura(printerIp, file.name, isMoonraker)
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

  const gramasDoCabecalho = filamentos.reduce((soma, f) => soma + f.gramas, 0);
  // Sem `filament used [g]` no cabeçalho, conta-se o E do próprio G-code.
  const gramasDetalhe = Number(detalhe?.EstWeight);
  const totalGramas =
    Number.isFinite(gramasDetalhe) && gramasDetalhe > 0
      ? gramasDetalhe
      : gramasDoCabecalho > 0
        ? gramasDoCabecalho
        : (consumo?.gramas ?? 0);
  const corpo = (
    <View
      className="bg-canvas rounded-t-2xl"
      style={painel ? { flex: 1 } : { maxHeight: '92%' }}
    >
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
              {detalhe?.EstTime
                ? ` · ${formatTempo(Number(detalhe.EstTime))}`
                : ''}
              {filamentos.length > 1
                ? ` · ${t('files.coresTotal', { n: filamentos.length })}`
                : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onAlternarFavorito}
            accessibilityRole="button"
            accessibilityLabel={t(
              favorito ? 'files.desfavoritar' : 'files.favoritar'
            )}
            accessibilityState={{ selected: favorito }}
            className="w-9 h-9 items-center justify-center rounded-lg border border-line mr-2"
            activeOpacity={0.7}
          >
            <Ionicons
              name={favorito ? 'star' : 'star-outline'}
              size={18}
              color={hexDe(tema.paleta.acento)}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('comum.fechar')}
            className="w-9 h-9 items-center justify-center rounded-lg border border-line"
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={hexDe(tema.paleta.tinta)} />
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
          <TouchableOpacity
            onPress={() => setAVerCamadas(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="mt-2 h-11 rounded-xl border border-line flex-row items-center justify-center"
          >
            <Ionicons
              name="layers-outline"
              size={16}
              color={hexDe(tema.paleta.acentoTexto)}
            />
            <Text className={`ml-2 text-[12px] font-semibold ${TX_ACENTO}`}>
              {t('camadas.ver')}
            </Text>
          </TouchableOpacity>
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
              rotulo: t('files.filamentos'),
              valor: String(coresVisiveis.length || filamentos.length || 0),
            },
            {
              rotulo: t('files.impressoes'),
              valor: reimpressoes > 0 ? String(reimpressoes) : '—',
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
                      backgroundColor: cor?.color ?? hexDe(tema.paleta.linha),
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
                            escolhido === tray ? 'text-ink' : 'text-ink-soft'
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
            <ActivityIndicator size="small" color={hexDe(tema.paleta.acento)} />
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
            <View key={filamento.tool} className="flex-row items-center mt-2.5">
              <View
                className="w-4 h-4 rounded-full border border-line mr-2"
                style={{
                  backgroundColor: filamento.cor ?? hexDe(tema.paleta.linha),
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
            <ActivityIndicator size="small" color={hexDe(tema.paleta.tinta)} />
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
  );

  const modalCamadas = aVerCamadas ? (
    <Modal
      animationType="slide"
      visible
      onRequestClose={() => setAVerCamadas(false)}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: hexDe(tema.paleta.fundo) }}
      >
        <Camadas
          printerIp={printerIp}
          nome={file.name}
          mini={mini}
          onClose={() => setAVerCamadas(false)}
        />
      </SafeAreaView>
    </Modal>
  ) : null;

  if (painel) {
    return (
      <View style={{ flex: 1 }}>
        {corpo}
        {modalCamadas}
      </View>
    );
  }

  return (
    <>
      <Modal transparent animationType="slide" visible onRequestClose={onClose}>
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          {corpo}
        </View>
      </Modal>
      {modalCamadas}
    </>
  );
};
