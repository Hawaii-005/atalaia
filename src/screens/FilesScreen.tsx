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
import { carregarInventario } from '../utils/inventario';
import { verificarTodosOsSlots } from '../utils/filamentos/verificacao';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { uploadGcode } from '../utils/gcodeUpload';
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
import { DetalheFicheiro } from './ficheiros/DetalheFicheiro';
import { FileRow } from './ficheiros/FileRow';
import { PrinterFile } from './ficheiros/tipos';

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

  const handlePrint = async (
    file: PrinterFile,
    slotMap: any[] = [],
    ferramentasGcode: any[] = []
  ) => {
    const label = file.name.split('/').pop() ?? file.name;
    let avisoTexto = '';
    try {
      const inv = await carregarInventario();
      const bobinasLocais = inv.rolos.filter(r => r.printerId === printer?.id);
      const ferramentas = (ferramentasGcode ?? []).map((f: any) => ({
        index: f.tool ?? f.index ?? 0,
        material: f.material,
        pesoG: f.gramas ?? f.pesoG,
      }));
      const avisos = verificarTodosOsSlots(ferramentas, bobinasLocais);
      if (avisos.length > 0) {
        avisoTexto =
          '\n\n⚠️ Avisos de Compatibilidade:\n' +
          avisos.map(a => `• ${a.mensagem}`).join('\n');
      }
    } catch {
      // Ignorar erros de leitura de inventario ao abrir o dialogo
    }

    Alert.alert(
      t('files.imprimirTitulo'),
      t('files.imprimirMsg', { nome: label }) + avisoTexto,
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
        <DetalheFicheiro
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
