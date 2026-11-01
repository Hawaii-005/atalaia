import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  Modal,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

import { Header } from '../../components/Header';
import { useTheme } from '../../contexts/ThemeContext';
import { usePrinterConnections } from '../../contexts/PrinterConnectionsContext';
import { Paleta, TemaId, hexDe } from '../../theme/temas';
import {
  IDIOMAS,
  PreferenciaIdioma,
  definirPreferenciaIdioma,
  t,
  useIdioma,
} from '../../i18n';
import {
  DEFAULT_PREFS,
  NotificationPrefs,
  loadNotificationPrefs,
  notify,
  prepareNotifications,
  saveNotificationPrefs,
} from '../../utils/notifications';
import {
  lerTimelapseExperimental,
  guardarTimelapseExperimental,
} from '../../utils/timelapse';
import { gerarRelatorioDiagnostico } from '../../utils/diagnostico';
import {
  montarBackup,
  lerBackup,
  importarFilamentos,
} from '../../utils/backup';
import {
  carregarEstado,
  guardarEstado,
} from '../../utils/filamentos/armazenamento';
import {
  guardarLimiteQuaseNoFim,
  lerLimiteQuaseNoFim,
} from '../../utils/filamentos/preferencias';
import {
  EntradaDefinicao,
  ORDEM_SECOES,
  SecaoId,
  filtrarEntradas,
  idsVisiveis,
  normalizar,
  secoesVisiveis,
} from '../../utils/definicoes/pesquisa';
import {
  guardarPotenciaW,
  guardarPrecoKwh,
  lerPotenciaW,
  lerPrecoKwh,
} from '../../utils/definicoes/preferencias';
import { useLayout } from '../../hooks/useLayout';
import { ALVO_MINIMO, CampoPesquisa, Vazio } from './componentes';
import { ContextoDefinicoes } from './tipos';
import { SecaoImpressoras } from './secoes/Impressoras';
import { SecaoAparencia } from './secoes/Aparencia';
import { SecaoFila } from './secoes/Fila';
import { SecaoFilamentos } from './secoes/Filamentos';
import { SecaoDados } from './secoes/Dados';
import { SecaoSobre } from './secoes/Sobre';

type TokenCor = 'acento' | 'acentoForte' | 'ok' | 'aviso' | 'perigo';

const META: Record<
  SecaoId,
  { titulo: string; icone: string; cor: TokenCor; descricao: string }
> = {
  impressoras: {
    titulo: 'settings.seccaoMaquinas',
    icone: 'print-outline',
    cor: 'acento',
    descricao: 'settings.descSecaoImpressoras',
  },
  aparencia: {
    titulo: 'settings.seccaoAparencia',
    icone: 'color-palette-outline',
    cor: 'acentoForte',
    descricao: 'settings.descSecaoAparencia',
  },
  fila: {
    titulo: 'settings.seccaoFila',
    icone: 'list-outline',
    cor: 'aviso',
    descricao: 'settings.descSecaoFila',
  },
  filamentos: {
    titulo: 'settings.seccaoFilamentos',
    icone: 'layers-outline',
    cor: 'ok',
    descricao: 'settings.descSecaoFilamentos',
  },
  dados: {
    titulo: 'settings.seccaoDados',
    icone: 'shield-checkmark-outline',
    cor: 'acento',
    descricao: 'settings.descSecaoDados',
  },
  sobre: {
    titulo: 'settings.seccaoSobre',
    icone: 'information-circle-outline',
    cor: 'acento',
    descricao: 'settings.descSecaoSobre',
  },
};

const corDa = (paleta: Paleta, token: TokenCor) => hexDe(paleta[token]);

export const SettingsScreen = () => {
  const { preferencia } = useIdioma();
  const { tema, temaId, setTema } = useTheme();
  const navegacao = useNavigation<any>();
  const {
    printers,
    statusIntervalMs,
    setStatusInterval,
    filaAuto,
    fila,
    definirFilaAuto,
    addPrinter,
  } = usePrinterConnections();

  const { isTablet } = useLayout();
  const [consulta, setConsulta] = useState('');
  const [seccaoAberta, setSeccaoAberta] = useState<SecaoId | null>(null);
  const [mostrarIdiomas, setMostrarIdiomas] = useState(false);
  const [aGuardarIdioma, setAGuardarIdioma] = useState(false);
  const [notificacoes, setNotificacoes] =
    useState<NotificationPrefs>(DEFAULT_PREFS);
  const [modoRemoto, setModoRemoto] = useState(false);
  const [timelapseExperimental, setTimelapseExperimental] = useState(false);
  const [limite, setLimite] = useState(15);
  const [precoKwh, setPrecoKwh] = useState(0);
  const [potenciaW, setPotenciaW] = useState(0);

  useEffect(() => {
    loadNotificationPrefs().then(setNotificacoes);
    AsyncStorage.getItem('modoRemoto')
      .then(valor => setModoRemoto(valor === '1'))
      .catch(() => undefined);
    lerTimelapseExperimental().then(setTimelapseExperimental);
    lerLimiteQuaseNoFim().then(setLimite);
    lerPrecoKwh().then(setPrecoKwh);
    lerPotenciaW().then(setPotenciaW);
  }, []);

  // Voltar do detalhe com o botão físico do Android.
  useEffect(() => {
    if (isTablet || seccaoAberta === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSeccaoAberta(null);
      return true;
    });
    return () => sub.remove();
  }, [isTablet, seccaoAberta]);

  const entradas = useMemo<EntradaDefinicao[]>(
    () => [
      {
        id: 'impressoras.lista',
        secao: 'impressoras',
        titulo: t('settings.seccaoMaquinas'),
        ajuda: t('settings.ajudaImpressoras'),
        palavras: ['ip', 'ligacao', 'ligação', 'estado', 'resina'],
      },
      {
        id: 'impressoras.adicionar',
        secao: 'impressoras',
        titulo: t('settings.adicionarImpressora'),
        ajuda: t('settings.ajudaAdicionarImpressora'),
        palavras: ['nova', 'descoberta', 'lan'],
      },
      {
        id: 'impressoras.alternativo',
        secao: 'impressoras',
        titulo: t('settings.enderecoAlternativo'),
        ajuda: t('settings.enderecoAlternativoDesc'),
        palavras: ['tailscale', 'vpn', 'remoto', 'fora de casa'],
      },
      {
        id: 'aparencia.tema',
        secao: 'aparencia',
        titulo: t('settings.tema'),
        ajuda: t('settings.ajudaTema'),
        palavras: ['cores', 'escuro', 'claro'],
      },
      {
        id: 'aparencia.intervalo',
        secao: 'aparencia',
        titulo: t('settings.intervalo'),
        ajuda: t('settings.ajudaIntervalo'),
        palavras: ['actualizacao', 'atualização', 'segundos'],
      },
      {
        id: 'aparencia.idioma',
        secao: 'aparencia',
        titulo: t('settings.language'),
        ajuda: t('settings.languageDescription'),
        palavras: ['lingua', 'língua', 'portugues', 'english'],
      },
      {
        id: 'fila.auto',
        secao: 'fila',
        titulo: t('settings.filaAuto'),
        ajuda: t('settings.filaAutoDesc'),
        palavras: ['fila', 'seguinte', 'automatico'],
      },
      {
        id: 'fila.pausa',
        secao: 'fila',
        titulo: t('settings.pausaFila'),
        ajuda: t('settings.pausaFilaDesc'),
        palavras: ['espera', 'intervalo', 'arranque'],
      },
      {
        id: 'fila.mesaLimpa',
        secao: 'fila',
        titulo: t('settings.mesaLimpa'),
        ajuda: t('settings.mesaLimpaDesc'),
        palavras: ['confirmacao', 'confirmação', 'mesa', 'fila'],
      },
      {
        id: 'fila.notifConcluida',
        secao: 'fila',
        titulo: t('settings.notifConcluida'),
        ajuda: t('settings.notifConcluidaDesc'),
        palavras: ['aviso', 'notificacao', 'terminou'],
      },
      {
        id: 'fila.notifPausada',
        secao: 'fila',
        titulo: t('settings.notifPausada'),
        ajuda: t('settings.notifPausadaDesc'),
        palavras: ['aviso', 'pausa', 'cancelada'],
      },
      {
        id: 'fila.notifMarcos',
        secao: 'fila',
        titulo: t('settings.notifMarcos'),
        ajuda: t('settings.notifMarcosDesc'),
        palavras: ['50', '90', 'progresso'],
      },
      {
        id: 'fila.notifDesligada',
        secao: 'fila',
        titulo: t('settings.notifDesligada'),
        ajuda: t('settings.notifDesligadaDesc'),
        palavras: ['offline', 'desligou'],
      },
      {
        id: 'fila.modoRemoto',
        secao: 'fila',
        titulo: t('settings.modoRemoto'),
        ajuda: t('settings.modoRemotoDesc'),
        palavras: ['dados', 'camara', 'câmara', 'fora de casa'],
      },
      {
        id: 'fila.testeNotif',
        secao: 'fila',
        titulo: t('settings.notificacaoTeste'),
        ajuda: t('settings.ajudaTesteNotificacao'),
        palavras: ['teste', 'notificacao'],
      },
      {
        id: 'filamentos.limite',
        secao: 'filamentos',
        titulo: t('settings.limiteTitulo'),
        ajuda: t('settings.limiteDesc'),
        palavras: ['bobina', 'rolo', 'quase no fim', 'percentagem'],
      },
      {
        id: 'filamentos.kwh',
        secao: 'filamentos',
        titulo: t('settings.kwhTitulo'),
        ajuda: t('settings.kwhDesc'),
        palavras: ['energia', 'electricidade', 'eletricidade', 'custo'],
      },
      {
        id: 'filamentos.potencia',
        secao: 'filamentos',
        titulo: t('settings.potenciaTitulo'),
        ajuda: t('settings.potenciaDesc'),
        palavras: ['watts', 'energia', 'consumo'],
      },
      {
        id: 'filamentos.inventario',
        secao: 'filamentos',
        titulo: t('settings.consumiveis'),
        ajuda: t('settings.consumiveisDesc'),
        palavras: ['inventario', 'bobinas', 'garrafas', 'preco'],
      },
      {
        id: 'dados.exportar',
        secao: 'dados',
        titulo: t('settings.exportar'),
        ajuda: t('settings.exportarDesc'),
        palavras: ['backup', 'json', 'guardar'],
      },
      {
        id: 'dados.importar',
        secao: 'dados',
        titulo: t('settings.importar'),
        ajuda: t('settings.importarDesc'),
        palavras: ['backup', 'restaurar', 'json'],
      },
      {
        id: 'dados.diagnostico',
        secao: 'dados',
        titulo: t('settings.exportarDiagnostico'),
        ajuda: t('settings.exportarDiagnosticoDesc'),
        palavras: ['relatorio', 'erros', 'suporte'],
      },
      {
        id: 'dados.timelapse',
        secao: 'dados',
        titulo: t('settings.timelapseExperimental'),
        ajuda: t('settings.timelapseExperimentalDesc'),
        palavras: ['video', 'vídeo', 'experimental'],
      },
      {
        id: 'dados.boasVindas',
        secao: 'dados',
        titulo: t('settings.reiniciarBoasVindas'),
        ajuda: t('settings.reiniciarBoasVindasMsg'),
        palavras: ['primeiros passos', 'tutorial'],
      },
      {
        id: 'sobre.versao',
        secao: 'sobre',
        titulo: t('settings.versaoApp'),
        palavras: ['build', 'numero'],
      },
      {
        id: 'sobre.github',
        secao: 'sobre',
        titulo: 'GitHub',
        palavras: ['repositorio', 'codigo'],
      },
      {
        id: 'sobre.issues',
        secao: 'sobre',
        titulo: t('settings.comunicarProblema'),
        palavras: ['bug', 'erro', 'github'],
      },
      {
        id: 'sobre.licenca',
        secao: 'sobre',
        titulo: t('settings.licenca'),
        palavras: ['mit', 'cc-tool', 'creditos'],
      },
    ],
    [preferencia]
  );

  const filtradas = filtrarEntradas(entradas, consulta);
  const visiveis = idsVisiveis(entradas, consulta);
  const secoes = secoesVisiveis(entradas, consulta);
  const aProcurar = normalizar(consulta).length > 0;
  const visivel = (id: string) => visiveis.has(id);

  const seccaoActual: SecaoId | null = isTablet
    ? seccaoAberta && secoes.includes(seccaoAberta)
      ? seccaoAberta
      : (secoes[0] ?? null)
    : seccaoAberta;

  const guardarIdioma = async (valor: PreferenciaIdioma) => {
    setAGuardarIdioma(true);
    try {
      await definirPreferenciaIdioma(valor);
      setMostrarIdiomas(false);
    } catch {
      Alert.alert(t('comum.erro'), t('settings.languageChangeFailed'));
    } finally {
      setAGuardarIdioma(false);
    }
  };

  const abrirUrl = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {
      Alert.alert(t('comum.erro'), t('comum.erroLigacao'));
    }
  };

  const alternarTimelapse = async (ligado: boolean) => {
    setTimelapseExperimental(ligado);
    await guardarTimelapseExperimental(ligado);
  };

  const alternarModoRemoto = (ligado: boolean) => {
    setModoRemoto(ligado);
    AsyncStorage.setItem('modoRemoto', ligado ? '1' : '0').catch(
      () => undefined
    );
  };

  const definirNotificacao = async (
    chave: keyof NotificationPrefs,
    valor: boolean
  ) => {
    const seguinte = { ...notificacoes, [chave]: valor };
    setNotificacoes(seguinte);
    await saveNotificationPrefs(seguinte);
    if (valor) await prepareNotifications();
  };

  const testarNotificacao = async () => {
    const concedidas = await prepareNotifications();
    if (!concedidas) {
      Alert.alert(
        t('settings.notifBloqueadas'),
        t('settings.notifBloqueadasMsg')
      );
      return;
    }
    await notify(
      t('settings.notifConcluida'),
      t('settings.notificacaoTesteCorpo')
    );
  };

  const guardarLimite = async (valor: number) => {
    const limpo = await guardarLimiteQuaseNoFim(valor);
    setLimite(limpo);
  };

  const guardarKwh = async (valor: number) => {
    const limpo = await guardarPrecoKwh(valor);
    setPrecoKwh(limpo);
  };

  const guardarPotencia = async (valor: number) => {
    const limpo = await guardarPotenciaW(valor);
    setPotenciaW(limpo);
  };

  const exportarDiagnostico = async () => {
    try {
      const relatorio = gerarRelatorioDiagnostico(printers);
      await Share.share({
        title: 'Ataláia - Diagnóstico',
        message: relatorio,
      });
    } catch {
      Alert.alert(
        t('settings.exportarDiagnostico'),
        t('settings.backupFalhou')
      );
    }
  };

  const reiniciarBoasVindas = () => {
    Alert.alert(
      t('settings.reiniciarBoasVindas'),
      t('settings.reiniciarBoasVindasMsg'),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('settings.reiniciar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('hasLaunched');
              Alert.alert(
                t('settings.concluido'),
                t('settings.boasVindasReiniciado')
              );
            } catch {
              Alert.alert(t('comum.erro'), t('settings.erroBoasVindas'));
            }
          },
        },
      ]
    );
  };

  const exportar = () => {
    Alert.alert(t('settings.backupTitulo'), t('settings.backupAvisoRede'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      { text: t('settings.exportar'), onPress: executarExportar },
    ]);
  };

  const executarExportar = async () => {
    try {
      const filamentos = await carregarEstado();
      const dados = montarBackup({
        impressoras: printers.map(p => ({
          printerName: p.printerName,
          ipAddress: p.ipAddress,
          alternateIp: p.alternateIp,
          mainboardId: p.mainboardId,
        })),
        preferencias: {
          statusIntervalMs,
          filaAuto,
          limiteQuaseNoFim: limite,
          precoKwh,
          potenciaW,
        },
        filamentos,
      });
      const permissao =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissao.granted) return;
      const ficheiro = await FileSystem.StorageAccessFramework.createFileAsync(
        permissao.directoryUri,
        'cc-tool-backup',
        'application/json'
      );
      await FileSystem.writeAsStringAsync(
        ficheiro,
        JSON.stringify(dados, null, 2)
      );
      Alert.alert(t('settings.backupTitulo'), t('settings.backupExportado'));
    } catch (erro) {
      Alert.alert(
        t('settings.backupTitulo'),
        erro instanceof Error ? erro.message : t('settings.backupFalhou')
      );
    }
  };

  const importar = async () => {
    try {
      const escolha = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (escolha.canceled) return;
      const texto = await FileSystem.readAsStringAsync(escolha.assets[0].uri);
      const dados = lerBackup(texto);
      if (dados.impressoras.length === 0) {
        Alert.alert(t('settings.backupTitulo'), t('settings.backupVazio'));
        return;
      }
      dados.impressoras.forEach(p => {
        addPrinter(p.printerName, p.ipAddress, p.mainboardId, p.alternateIp);
      });
      if (dados.filamentos) {
        const estado = await carregarEstado();
        const { estado: fundido } = importarFilamentos(estado, dados);
        await guardarEstado(fundido);
      }
      Alert.alert(
        t('settings.backupTitulo'),
        t('settings.backupImportado', { n: dados.impressoras.length })
      );
    } catch {
      Alert.alert(t('settings.backupTitulo'), t('settings.backupFalhou'));
    }
  };

  const ctx: ContextoDefinicoes = {
    versao: Constants.expoConfig?.version ?? '',
    printers,
    navegar: navegacao.navigate,
    abrirUrl,
    temaId,
    definirTema: setTema,
    intervaloMs: statusIntervalMs,
    definirIntervalo: setStatusInterval,
    preferenciaIdioma: preferencia,
    abrirIdiomas: () => setMostrarIdiomas(true),
    filaAuto,
    definirFilaAuto,
    filaTamanho: fila.length,
    modoRemoto,
    definirModoRemoto: alternarModoRemoto,
    notificacoes,
    definirNotificacao,
    testarNotificacao,
    limite,
    guardarLimite,
    precoKwh,
    guardarPrecoKwh: guardarKwh,
    potenciaW,
    guardarPotenciaW: guardarPotencia,
    exportar,
    importar,
    exportarDiagnostico,
    timelapseExperimental,
    definirTimelapse: alternarTimelapse,
    reiniciarBoasVindas,
  };

  const conteudoDaSecao = (seccao: SecaoId) => {
    const props = { ctx, visivel };
    switch (seccao) {
      case 'impressoras':
        return <SecaoImpressoras {...props} />;
      case 'aparencia':
        return <SecaoAparencia {...props} />;
      case 'fila':
        return <SecaoFila {...props} />;
      case 'filamentos':
        return <SecaoFilamentos {...props} />;
      case 'dados':
        return <SecaoDados {...props} />;
      case 'sobre':
        return <SecaoSobre {...props} />;
      default:
        return null;
    }
  };

  const subtitulo =
    printers.length > 0
      ? printers
          .map(pr => pr.printerName)
          .slice(0, 3)
          .join(' · ')
      : t('settings.subtitulo');

  const lista = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 88, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {secoes.length === 0 && <Vazio texto={t('settings.semResultados')} />}
      {secoes.map(seccao => {
        const meta = META[seccao];
        const cor = corDa(tema.paleta, meta.cor);
        const quantas = filtradas.filter(e => e.secao === seccao).length;
        return (
          <TouchableOpacity
            key={seccao}
            onPress={() => setSeccaoAberta(seccao)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t(meta.titulo)}
            className="flex-row items-center rounded-2xl border border-line bg-cartao px-4"
            style={{ minHeight: 64 }}
          >
            <View
              className="w-9 h-9 rounded-[11px] items-center justify-center"
              style={{ backgroundColor: cor + '1F' }}
            >
              <Ionicons name={meta.icone as any} size={18} color={cor} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[13px] font-semibold text-ink">
                {t(meta.titulo)}
              </Text>
              <Text className="text-[10px] text-ink-soft mt-0.5">
                {t(meta.descricao)}
              </Text>
            </View>
            {aProcurar && (
              <Text className="text-[11px] text-ink-muted mr-1">{quantas}</Text>
            )}
            <Ionicons
              name="chevron-forward"
              size={16}
              color={hexDe(tema.paleta.tintaMuted)}
            />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const detalhe = seccaoActual ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 88, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {conteudoDaSecao(seccaoActual)}
    </ScrollView>
  ) : (
    <Vazio texto={t('settings.semResultados')} />
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      {isTablet ? (
        <View className="flex-1 flex-row">
          <View className="border-r border-line" style={{ width: 320 }}>
            <Header title={t('settings.title')} subtitle={subtitulo} />
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <CampoPesquisa valor={consulta} aoMudar={setConsulta} />
            </View>
            {lista}
          </View>
          <View className="flex-1">
            <Header
              title={seccaoActual ? t(META[seccaoActual].titulo) : ''}
              subtitle={t('settings.title')}
            />
            {detalhe}
          </View>
        </View>
      ) : seccaoActual === null ? (
        <>
          <Header title={t('settings.title')} subtitle={subtitulo} />
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CampoPesquisa valor={consulta} aoMudar={setConsulta} />
          </View>
          {lista}
        </>
      ) : (
        <>
          <Header
            title={t(META[seccaoActual].titulo)}
            subtitle={t('settings.title')}
            onBack={() => setSeccaoAberta(null)}
          />
          {detalhe}
        </>
      )}

      <Modal
        visible={mostrarIdiomas}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!aGuardarIdioma) setMostrarIdiomas(false);
        }}
      >
        <SafeAreaView
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
        >
          <View
            className="rounded-2xl border border-line bg-cartao overflow-hidden"
            style={{ width: '100%', maxWidth: 480, maxHeight: '85%' }}
            accessibilityViewIsModal
          >
            <View className="flex-row items-center pl-4 pr-2 py-2">
              <Text className="flex-1 text-[18px] font-semibold text-ink">
                {t('settings.language')}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('comum.fechar')}
                disabled={aGuardarIdioma}
                onPress={() => setMostrarIdiomas(false)}
                style={{
                  minWidth: ALVO_MINIMO,
                  minHeight: ALVO_MINIMO,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={hexDe(tema.paleta.tinta)}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }}>
              {[
                { id: 'system' as const, nome: t('settings.languageSystem') },
                ...IDIOMAS,
              ].map(item => (
                <TouchableOpacity
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{
                    selected: preferencia === item.id,
                    disabled: aGuardarIdioma,
                  }}
                  disabled={aGuardarIdioma}
                  onPress={() => guardarIdioma(item.id)}
                  className="flex-row items-center px-4 py-4 border-t border-line"
                  style={{ minHeight: 56 }}
                >
                  <Text className="flex-1 text-[15px] text-ink">
                    {item.nome}
                  </Text>
                  {preferencia === item.id && (
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color={hexDe(tema.paleta.acentoTexto)}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};
