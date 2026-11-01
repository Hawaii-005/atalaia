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
  FlatList,
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
import { colunasFicheiros, useJanela } from '../theme/layout';
import {
  aplicarFiltros,
  contarFavoritos,
  nomeCurto,
  tamanhoDoFicheiro,
} from '../utils/ficheiros/lista';
import {
  carregarCache,
  guardarCache,
  idadeEmPartes,
} from '../utils/ficheiros/cache';
import {
  carregarFicheiros,
  gravarFicheiros,
  guardarAlternarFavorito,
  guardarArranque,
} from '../utils/ficheiros/armazenamento';
import {
  EstadoFicheiros,
  estadoVazio,
  podarRegistos,
  procurarRegisto,
} from '../utils/ficheiros/modelo';

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

const idadeDaCache = (iso: string): string => {
  const quando = new Date(iso).getTime();
  const partes = Number.isFinite(quando)
    ? idadeEmPartes(Date.now() - quando)
    : null;
  if (!partes) return t('files.cacheAgora');
  if (partes.unidade === 'min') return t('files.cacheMin', { n: partes.valor });
  if (partes.unidade === 'h') return t('files.cacheH', { n: partes.valor });
  return t('files.cacheDia', { n: partes.valor });
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
  favorito = false,
  largura,
  denso = false,
  onToggleFavorito,
}: {
  file: PrinterFile;
  printerIp: string;
  onOpen: () => void;
  modo?: 'lista' | 'grelha';
  lado?: number;
  /** Muda quando o utilizador pede para recarregar: força nova tentativa. */
  recarga?: number;
  favorito?: boolean;
  /** Largura fixa na grelha virtualizada (FlatList). */
  largura?: number;
  /** Cartões estreitos (6 ou 8 colunas): uma linha de nome, letra menor. */
  denso?: boolean;
  onToggleFavorito?: () => void;
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
        onLongPress={onToggleFavorito}
        delayLongPress={350}
        activeOpacity={0.8}
        accessibilityLabel={`${label}, ${legenda}`}
        accessibilityHint={t(
          favorito ? 'files.desfavoritar' : 'files.favoritar'
        )}
        style={{
          width:
            largura ?? (lado === 0 ? '100%' : lado === 1 ? '31.5%' : '48.5%'),
        }}
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
        <View className={denso ? 'px-1.5 py-1' : 'p-2'}>
          <Text
            className={`${denso ? 'text-[9.5px]' : 'text-[11px]'} font-semibold text-ink`}
            numberOfLines={denso ? 1 : 2}
          >
            {label}
          </Text>
          <View
            className={`flex-row items-center ${denso ? 'mt-0.5' : 'mt-1'}`}
          >
            <Text
              className={`${denso ? 'text-[9px]' : 'text-[10px]'} text-ink-muted flex-1`}
              numberOfLines={1}
            >
              {legenda}
            </Text>
            {favorito && (
              <Ionicons
                name="star"
                size={11}
                color={hexDe(tema.paleta.acento)}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onOpen}
      onLongPress={onToggleFavorito}
      delayLongPress={350}
      activeOpacity={0.7}
      accessibilityLabel={`${label}, ${legenda}`}
      accessibilityHint={t(favorito ? 'files.desfavoritar' : 'files.favoritar')}
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
      {favorito && (
        <Ionicons
          name="star"
          size={14}
          color={hexDe(tema.paleta.acento)}
          style={{ marginRight: 6 }}
        />
      )}
      <Ionicons
        name="chevron-forward"
        size={18}
        color={hexDe(tema.paleta.tintaMuted)}
      />
    </TouchableOpacity>
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
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [registos, setRegistos] = useState<EstadoFicheiros>(estadoVazio());
  /** Lista veio da cache porque a impressora não respondeu. */
  const [emCache, setEmCache] = useState<string | null>(null);
  const janela = useJanela();
  /** Tablet em paisagem: lista à esquerda, detalhe à direita (bloco 1–12). */
  const duasColunas = janela.width >= 1000;

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
        if (g.soFavoritos === true) setSoFavoritos(true);
      })
      .catch(() => undefined);
  }, []);

  const escolherVista = (valor: 'lista' | 'grelha') => {
    setVista(valor);
    AsyncStorage.setItem(
      'atalaia.ficheiros.prefs',
      JSON.stringify({ vista: valor, tamanhoMini, soFavoritos })
    ).catch(() => undefined);
  };

  const escolherTamanho = (valor: 'p' | 'm' | 'g') => {
    setTamanhoMini(valor);
    AsyncStorage.setItem(
      'atalaia.ficheiros.prefs',
      JSON.stringify({ vista, tamanhoMini: valor, soFavoritos })
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
    setEmCache(null);
    const registoActual = await carregarFicheiros();
    setRegistos(registoActual);
    try {
      const list = (await listarTodosOsFicheiros()).filter(item =>
        item.name?.toLowerCase().endsWith('.gcode')
      );
      setFiles(list);
      // A última lista boa fica guardada: é o que se mostra sem ligação.
      await guardarCache(printerIdAtual, list);
      // Esquece favoritos e contadores de ficheiros que já não existem.
      const podado = podarRegistos(registoActual, {
        [printerIdAtual]: list.map(item => item.name),
      });
      if (podado !== registoActual) {
        await gravarFicheiros(podado);
        setRegistos(podado);
      }
    } catch (e) {
      const cache = await carregarCache(printerIdAtual);
      if (cache) {
        setFiles(cache.ficheiros);
        setEmCache(cache.guardadoEm);
      } else {
        setError(mensagemDeErro(e));
      }
    } finally {
      setLoading(false);
    }
  }, [printerIdAtual, listarTodosOsFicheiros]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ehFavorito = useCallback(
    (nome: string) =>
      !!printerIdAtual &&
      !!procurarRegisto(registos, { printerId: printerIdAtual, nome })
        ?.favorito,
    [registos, printerIdAtual]
  );

  const visiveis = useMemo(
    () =>
      aplicarFiltros(
        files,
        {
          texto: procura,
          ordem,
          crescente,
          apenasFavoritos: soFavoritos,
        },
        ehFavorito
      ),
    [files, ordem, crescente, procura, soFavoritos, ehFavorito]
  );

  const totalFavoritos = useMemo(
    () => contarFavoritos(files, ehFavorito),
    [files, ehFavorito]
  );

  const [larguraLista, setLarguraLista] = useState(0);
  const colunasGrelha =
    vista === 'grelha' ? colunasFicheiros(janela.classe, tamanhoMini) : 1;
  const larguraItem =
    colunasGrelha > 1 && larguraLista
      ? Math.floor(
          (larguraLista - 24 - (colunasGrelha - 1) * 8) / colunasGrelha
        )
      : undefined;

  const alternarFavoritoDoFicheiro = useCallback(
    async (file: PrinterFile) => {
      if (!printerIdAtual) return;
      const novo = await guardarAlternarFavorito({
        printerId: printerIdAtual,
        nome: file.name,
        tamanho: tamanhoDoFicheiro(file) || undefined,
      });
      setRegistos(novo);
    },
    [printerIdAtual]
  );

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
              // O id do comando serve de testemunho: o contador local conta
              // este arranque uma vez, mesmo que o toque se repita.
              const jobId = `print-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
              const comando = startPrintCommand(
                file.name,
                {
                  nivelar: bedLevel,
                  lado: plateSide,
                  slotMap,
                  timelapse: (await lerTimelapse(printer.id)) ? 1 : 0,
                },
                { id: jobId }
              );
              const response = await request(printer.id, comando, 15000);
              const ack = ackDaResposta(response) ?? 0;
              if (ack !== 0) {
                Alert.alert(t('files.naoArrancou'), descreverAck(ack));
                return;
              }
              await guardarArranque(
                {
                  printerId: printer.id,
                  nome: file.name,
                  tamanho: tamanhoDoFicheiro(file) || undefined,
                },
                comando.Id || jobId
              ).then(setRegistos);
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

  const renderDetalhe = (painel: boolean) => {
    if (!selecionado) return null;
    const alvo = selecionado;
    return (
      <DetalheFicheiro
        painel={painel}
        file={alvo}
        printerIp={enderecoDe(printer)}
        printerId={printer.id}
        bedLevel={bedLevel}
        onChangeBedLevel={setBedLevel}
        plateSide={plateSide}
        onChangePlateSide={setPlateSide}
        favorito={ehFavorito(alvo.name)}
        onAlternarFavorito={() => alternarFavoritoDoFicheiro(alvo)}
        reimpressoes={
          procurarRegisto(registos, {
            printerId: printer.id,
            nome: alvo.name,
            tamanho: tamanhoDoFicheiro(alvo) || undefined,
          })?.reimpressoes ?? 0
        }
        ultimaImpressao={
          procurarRegisto(registos, {
            printerId: printer.id,
            nome: alvo.name,
            tamanho: tamanhoDoFicheiro(alvo) || undefined,
          })?.ultimaImpressao
        }
        onClose={() => setSelecionado(null)}
        onAddToQueue={() => {
          if (!printer) return;
          adicionarAFila({
            id: `${Date.now()}-${alvo.name}`,
            printerId: printer.id,
            name: alvo.name,
            label: alvo.name.split('/').pop() ?? alvo.name,
          });
          setSelecionado(null);
          Alert.alert(t('files.filaTitulo'), t('files.filaAdicionado'));
        }}
        onPrint={slotMap => {
          setSelecionado(null);
          handlePrint(alvo, slotMap);
        }}
        onRename={() => {
          setSelecionado(null);
          setNovoNome(
            (alvo.name.split('/').pop() ?? '').replace(/\.gcode$/i, '')
          );
          setARenomear(alvo);
        }}
        onDelete={() => {
          setSelecionado(null);
          handleDelete(alvo);
        }}
      />
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
        <View
          style={{ flex: 1, flexDirection: duasColunas ? 'row' : 'column' }}
        >
          <View
            style={{ flex: 1 }}
            onLayout={evento =>
              setLarguraLista(evento.nativeEvent.layout.width)
            }
          >
            {emCache ? (
              <TouchableOpacity
                onPress={load}
                activeOpacity={0.8}
                accessibilityRole="button"
                className="flex-row items-center px-4 py-2 border-b border-line bg-canvas-sunken"
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={16}
                  color={hexDe(tema.paleta.tintaSoft)}
                />
                <View className="flex-1 ml-2">
                  <Text className="text-[12px] font-semibold text-ink">
                    {t('files.cacheTitulo')}
                  </Text>
                  <Text className="text-[11px] text-ink-muted mt-0.5">
                    {t('files.cacheAviso', { quando: idadeDaCache(emCache) })}
                  </Text>
                </View>
                <Text className="text-[12px] font-semibold text-brand">
                  {t('files.tentarDeNovo')}
                </Text>
              </TouchableOpacity>
            ) : null}
            <FlatList
              key={`${vista}-${tamanhoMini}`}
              data={visiveis}
              keyExtractor={item => item.name}
              numColumns={colunasGrelha}
              columnWrapperStyle={
                colunasGrelha > 1
                  ? { paddingHorizontal: 12, gap: 8 }
                  : undefined
              }
              initialNumToRender={14}
              maxToRenderPerBatch={14}
              windowSize={9}
              removeClippedSubviews
              contentContainerStyle={{ paddingBottom: 32 }}
              ListHeaderComponent={
                <>
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
                            plateSide === side
                              ? 'bg-brand border-brand'
                              : 'border-line'
                          }`}
                        >
                          <Text
                            className={`text-[13px] font-semibold ${
                              plateSide === side
                                ? 'text-white'
                                : 'text-ink-soft'
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
                    <TouchableOpacity
                      onPress={() => {
                        const valor = !soFavoritos;
                        setSoFavoritos(valor);
                        AsyncStorage.setItem(
                          'atalaia.ficheiros.prefs',
                          JSON.stringify({
                            vista,
                            tamanhoMini,
                            soFavoritos: valor,
                          })
                        ).catch(() => undefined);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: soFavoritos }}
                      className={`flex-row items-center h-8 px-3 rounded-full border mr-2 ${
                        soFavoritos ? 'bg-brand border-brand' : 'border-line'
                      }`}
                    >
                      <Ionicons
                        name={soFavoritos ? 'star' : 'star-outline'}
                        size={13}
                        color={
                          soFavoritos ? '#FFFFFF' : hexDe(tema.paleta.tintaSoft)
                        }
                      />
                      <Text
                        className={`text-[12px] font-semibold ml-1.5 ${
                          soFavoritos ? 'text-white' : 'text-ink-soft'
                        }`}
                      >
                        {t('files.soFavoritos')}
                      </Text>
                      {totalFavoritos > 0 && (
                        <Text
                          className={`text-[11px] ml-1.5 ${
                            soFavoritos ? 'text-white' : 'text-ink-muted'
                          }`}
                        >
                          {totalFavoritos}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <Text
                      className="text-[11px] text-ink-muted ml-auto"
                      numberOfLines={1}
                    >
                      {soFavoritos || procura.trim()
                        ? `${visiveis.length}/${files.length}`
                        : t('files.contagem', { n: files.length })}
                    </Text>
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
                                ordem === criterio
                                  ? 'text-white'
                                  : 'text-ink-soft'
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
                              vista === modo
                                ? '#FFFFFF'
                                : hexDe(tema.paleta.tintaSoft)
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
                                tamanhoMini === tam
                                  ? 'text-white'
                                  : 'text-ink-soft'
                              }`}
                            >
                              {tam.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              }
              ListEmptyComponent={
                files.length === 0 ? (
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
                ) : (
                  <View className="px-6 py-10 items-center">
                    <Ionicons
                      name={
                        soFavoritos && !procura.trim()
                          ? 'star-outline'
                          : 'search'
                      }
                      size={20}
                      color={hexDe(tema.paleta.tintaMuted)}
                    />
                    <Text className="text-[13px] text-ink-muted mt-2 text-center">
                      {soFavoritos && !procura.trim()
                        ? t('files.semFavoritos')
                        : t('files.semResultados', { q: procura.trim() })}
                    </Text>
                    {soFavoritos && (
                      <TouchableOpacity
                        onPress={() => {
                          setSoFavoritos(false);
                          AsyncStorage.setItem(
                            'atalaia.ficheiros.prefs',
                            JSON.stringify({
                              vista,
                              tamanhoMini,
                              soFavoritos: false,
                            })
                          ).catch(() => undefined);
                        }}
                        className="mt-4 px-4 py-2 rounded-lg border border-line"
                      >
                        <Text className="text-[13px] font-semibold text-ink">
                          {t('files.verTodos')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }
              renderItem={({ item }) => (
                <FileRow
                  file={item}
                  printerIp={enderecoDe(printer)}
                  recarga={recarga}
                  modo={vista}
                  lado={tamanhoMini === 'p' ? 1 : tamanhoMini === 'm' ? 2 : 0}
                  largura={vista === 'grelha' ? larguraItem : undefined}
                  denso={vista === 'grelha' && colunasGrelha >= 6}
                  favorito={ehFavorito(item.name)}
                  onToggleFavorito={() => alternarFavoritoDoFicheiro(item)}
                  onOpen={() => setSelecionado(item)}
                />
              )}
            />
          </View>
          {duasColunas && selecionado ? (
            <View
              style={{
                width: 400,
                borderLeftWidth: 1,
                borderLeftColor: hexDe(tema.paleta.linha),
              }}
            >
              {renderDetalhe(true)}
            </View>
          ) : null}
        </View>
      )}

      {!duasColunas && renderDetalhe(false)}
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
          style={{ right: duasColunas ? 420 : 20, bottom: 28 }}
          className={`absolute ${BT_ACENTO} px-4 py-3 rounded-full flex-row items-center`}
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
