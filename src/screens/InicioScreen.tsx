import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSelectedPrinter } from '../contexts/SelectedPrinterContext';
import { t, useIdioma } from '../i18n';
import { Printer } from '../types';
import { loadHistory, PrintRecord } from '../utils/printHistory';
import { useJanela } from '../theme/layout';
import {
  espaco,
  margemEcra,
  obterPaleta,
  raio,
  texto as tipos,
} from '../theme/tokensV6';
import { CartaoFila } from '../components/CartaoFila';
import {
  AnelProgresso,
  CabecalhoImpressora,
  CartaoTemperatura,
  SlotsCanvas,
} from '../components/inicio';
import {
  carregarInventario,
  custoPorGrama,
  garrafaActiva,
  Inventario,
  roloActivo,
} from '../utils/inventario';
import {
  estadoDoTrabalho,
  formatarPercentagem,
  formatarRestante,
  restanteEmSegundos,
} from '../utils/inicio/formatadores';
import { LIMITE_QUASE_NO_FIM, Spool } from '../utils/filamentos/modelo';
import { construirVistaSlots } from '../utils/filamentos/vista';
import {
  canvasSlotsCommand,
  CanvasTray,
  lightCommand,
  pausePrintCommand,
  resumePrintCommand,
  stopPrintCommand,
  videoCommand,
} from '../utils/commands';
import { SecaoCamara } from './inicio/SecaoCamara';
import { CartaoTrabalho } from './inicio/CartaoTrabalho';
import { SeletorMaquinas } from './inicio/SeletorMaquinas';
import { LinhaConsumivel } from './inicio/LinhaConsumivel';
import { ListaHistorico } from './inicio/ListaHistorico';

const euros = (valor: number) => `${valor.toFixed(2).replace('.', ',')} €`;

/**
 * Início — o ecrã de quem só quer saber «está a correr bem?».
 *
 * Segue os blocos aprovados em `docs/design/inicio/`. A ordem muda entre
 * telemóvel e tablet; os blocos são os mesmos. Nada aqui inventa dados: gramas
 * por slot e cores do G-code só aparecem quando existem mesmo.
 */
export const InicioScreen = ({ navigation }: any) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);
  const { printers, request } = usePrinterConnections();
  const { mudarMaquina, mudarSecao } = useSelectedPrinter();
  const { expandida } = useJanela();
  const emFoco = useIsFocused();
  const duasColunas = expandida;

  const [historico, setHistorico] = useState<PrintRecord[]>([]);
  const [inventario, setInventario] = useState<Inventario>({
    rolos: [],
    garrafas: [],
    pendentes: [],
  });
  const [escolhidaId, setEscolhidaId] = useState<string | undefined>(undefined);
  const [camaraAberta, setCamaraAberta] = useState(false);
  const [slots, setSlots] = useState<CanvasTray[] | null>(null);
  const [trayAtivo, setTrayAtivo] = useState(-1);
  const [ticksParados, setTicksParados] = useState(false);

  useEffect(() => {
    if (!emFoco) return;
    loadHistory()
      .then(setHistorico)
      .catch(() => {});
    carregarInventario()
      .then(setInventario)
      .catch(() => {});
  }, [emFoco]);

  useEffect(() => {
    if (escolhidaId && printers.some(maquina => maquina.id === escolhidaId)) {
      return;
    }
    const ligadaJa =
      printers.find(maquina => maquina.connectionStatus === 'connected') ??
      printers[0];
    setEscolhidaId(ligadaJa?.id);
  }, [printers, escolhidaId]);

  const escolhida = useMemo(
    () => printers.find(maquina => maquina.id === escolhidaId) ?? printers[0],
    [printers, escolhidaId]
  );
  const outras = printers.filter(maquina => maquina.id !== escolhida?.id);

  const resina = (escolhida?.kind ?? 'fdm') === 'resin';
  const info = escolhida?.status?.PrintInfo;
  const ligada = escolhida?.connectionStatus === 'connected';
  const luzLigada = !!escolhida?.status?.LightStatus?.SecondLight;
  const estado = estadoDoTrabalho({ ligada, printInfo: info, ticksParados });
  // Só um trabalho a decorrer conta para o anel. Depois de terminar, a máquina
  // mantém o PrintInfo da última impressão — mostrar esses números ao lado de
  // «sem trabalhos a correr» seria mentir sobre o presente.
  const emCurso =
    estado === 'imprimindo' || estado === 'pausada' || estado === 'preparando';
  const temTrabalho = emCurso && !!info?.Filename;
  const progresso =
    estado === 'terminada' ? 100 : emCurso ? (info?.Progress ?? 0) : 0;
  const restante = emCurso ? formatarRestante(restanteEmSegundos(info)) : null;
  const camadas =
    emCurso && info?.TotalLayer
      ? `${t('detalhes.camada')} ${info?.CurrentLayer ?? 0} / ${info.TotalLayer}`
      : null;

  // A pausa não tem código próprio: o que muda é o tempo de impressão parar de
  // andar. Um temporizador compara os ticks e destapa o estado «em pausa».
  const ticksRef = useRef<{ ticks: number } | null>(null);
  useEffect(() => {
    if (!info?.Filename) {
      ticksRef.current = null;
      setTicksParados(false);
      return;
    }
    if (ticksRef.current && ticksRef.current.ticks !== info.CurrentTicks) {
      setTicksParados(false);
    }
    ticksRef.current = { ticks: info.CurrentTicks };
    const id = setInterval(() => {
      setTicksParados(
        !!ticksRef.current && ticksRef.current.ticks === info.CurrentTicks
      );
    }, 15000);
    return () => clearInterval(id);
  }, [info?.CurrentTicks, info?.Filename]);

  // Slots do CANVAS: só a uma FDM ligada, e só com o ecrã em foco.
  useEffect(() => {
    if (!emFoco || !escolhida || resina || !ligada) return;
    let vivo = true;
    request(escolhida.id, canvasSlotsCommand({ id: escolhida.id }), 10000)
      .then((resposta: any) => {
        if (!vivo) return;
        const dados = resposta?.Data ?? resposta;
        const lista = dados?.canvas_list?.[0]?.tray_list;
        setSlots(Array.isArray(lista) ? lista : []);
        setTrayAtivo(
          typeof dados?.active_tray_id === 'number' ? dados.active_tray_id : -1
        );
      })
      .catch(() => {
        if (vivo) setSlots([]);
      });
    return () => {
      vivo = false;
    };
  }, [emFoco, escolhida, resina, ligada, request]);

  // O vídeo da Centauri só aceita uma ligação: liga ao entrar, desliga ao sair.
  useEffect(() => {
    if (!emFoco || !escolhida || !ligada || resina) return;
    try {
      request(escolhida.id, videoCommand(true, { id: escolhida.id }), 8000);
    } catch {
      // sem ligação, a moldura mostra «sem sinal»
    }
  }, [emFoco, escolhida, ligada, resina, request]);

  const acao = useCallback(
    async (printer: Printer, tipo: 'pausar' | 'retomar' | 'parar') => {
      const executar = async () => {
        try {
          await request(
            printer.id,
            tipo === 'parar'
              ? stopPrintCommand({ id: `cancel-${Date.now()}` })
              : tipo === 'retomar'
                ? resumePrintCommand({ id: `resume-${Date.now()}` })
                : pausePrintCommand({ id: `pause-${Date.now()}` })
          );
        } catch (erro) {
          Alert.alert(
            t('comum.erro'),
            erro instanceof Error ? erro.message : String(erro)
          );
        }
      };
      if (tipo !== 'parar') return executar();
      Alert.alert(
        t('comum.cancelarImpressao'),
        t('comum.interrompeImpressao'),
        [
          { text: t('comum.continuarImpressao'), style: 'cancel' },
          {
            text: t('comum.cancelarImpressao'),
            style: 'destructive',
            onPress: executar,
          },
        ]
      );
    },
    [request]
  );

  const alternarLuz = useCallback(async () => {
    if (!escolhida) return;
    try {
      await request(
        escolhida.id,
        lightCommand(!luzLigada, { id: `luz-${Date.now()}` }),
        8000
      );
    } catch (erro) {
      Alert.alert(
        t('comum.erro'),
        erro instanceof Error ? erro.message : String(erro)
      );
    }
  }, [escolhida, luzLigada, request]);

  const rolo = escolhida
    ? roloActivo(inventario.rolos, escolhida.id)
    : undefined;
  const garrafa = escolhida
    ? garrafaActiva(inventario.garrafas, escolhida.id)
    : undefined;

  const vistasSlots = useMemo(() => {
    if (!slots || !escolhida || resina) return [];
    return construirVistaSlots(
      slots,
      inventario.rolos as Spool[],
      escolhida.id,
      LIMITE_QUASE_NO_FIM,
      trayAtivo
    );
  }, [slots, escolhida, inventario.rolos, resina, trayAtivo]);

  const historicoDaMaquina = useMemo(
    () =>
      historico.filter(
        registo =>
          !registo.printerName || registo.printerName === escolhida?.printerName
      ),
    [historico, escolhida?.printerName]
  );

  if (!escolhida) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: p.fundo }}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: espaco.xl,
          }}
        >
          <Text
            style={{
              ...tipos.legenda,
              color: p.textoSecundario,
              textAlign: 'center',
            }}
          >
            {t('camera.semImpressoras')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEditPrinter')}
            style={{
              marginTop: espaco.md,
              paddingHorizontal: espaco.lg,
              height: 42,
              borderRadius: raio.botao,
              backgroundColor: p.primaria,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ ...tipos.legendaForte, color: p.textoSobrePrimaria }}
            >
              {t('home.adicionarImpressora')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const abrirCamara = () =>
    navigation.navigate('Camera', { printerId: escolhida.id });
  const irParaFicheiros = () => {
    mudarMaquina(escolhida.id);
    mudarSecao('ficheiros');
    navigation.navigate('Impressora');
  };
  const irParaFilamentos = () => {
    mudarMaquina(escolhida.id);
    mudarSecao('filamentos');
    navigation.navigate('Impressora');
  };

  // ── blocos ────────────────────────────────────────────────────────────────

  const blocoSeletor =
    printers.length > 1 ? (
      <SeletorMaquinas
        maquinas={printers.map(maquina => ({
          id: maquina.id,
          nome: maquina.printerName,
          estado: estadoDoTrabalho({
            ligada: maquina.connectionStatus === 'connected',
            printInfo: maquina.status?.PrintInfo,
          }),
        }))}
        activaId={escolhida.id}
        onEscolher={setEscolhidaId}
      />
    ) : null;

  const blocoCamara = (
    <SecaoCamara
      host={escolhida.ipAddress}
      activa={emFoco && ligada && !resina}
      grande={duasColunas}
      aberta={camaraAberta}
      onAbrir={() => setCamaraAberta(true)}
      onFechar={() => setCamaraAberta(false)}
      luzLigada={luzLigada}
      onLuz={alternarLuz}
      onAbrirCamara={abrirCamara}
    />
  );

  const blocoAnel = (
    <View
      style={{
        flexDirection: duasColunas ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: espaco.lg,
        padding: espaco.lg,
        borderRadius: raio.cartao,
        backgroundColor: p.cartao,
        borderWidth: 1,
        borderColor: p.contorno,
      }}
    >
      <AnelProgresso
        progresso={progresso}
        tamanho={duasColunas ? 'grande' : 'medio'}
        legenda={restante}
        accessibilityLabel={`${formatarPercentagem(progresso)}${
          restante ? ` · ${restante}` : ''
        }`}
      />
      {camadas || estado === 'terminada' || restante ? (
        <View
          style={{
            flex: duasColunas ? 1 : 0,
            gap: 2,
            alignItems: duasColunas ? 'flex-start' : 'center',
          }}
        >
          <Text
            numberOfLines={1}
            style={{ ...tipos.micro, color: p.textoSecundario }}
          >
            {camadas ?? (estado === 'terminada' ? t('estado.terminada') : null)}
          </Text>
          {restante ? (
            <Text style={{ ...tipos.legendaForte, color: p.texto }}>
              {restante}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const blocoTrabalho = (
    <CartaoTrabalho
      nome={
        emCurso || estado === 'terminada'
          ? info?.Filename.split('/').pop()
          : undefined
      }
      camadaAtual={emCurso ? info?.CurrentLayer : undefined}
      camadaTotal={emCurso ? info?.TotalLayer : undefined}
      percentagem={progresso}
      restante={restante}
      resina={resina}
      onEscolher={irParaFicheiros}
    />
  );

  const blocoTemperaturas = resina ? null : (
    <View style={{ flexDirection: 'row', gap: espaco.sm }}>
      <CartaoTemperatura
        rotulo={t('comum.bico')}
        valor={escolhida.status?.TempOfNozzle}
        alvo={escolhida.status?.TempTargetNozzle}
        cor={p.bico}
        desactivado={!ligada}
      />
      <CartaoTemperatura
        rotulo={t('comum.mesa')}
        valor={escolhida.status?.TempOfHotbed}
        alvo={escolhida.status?.TempTargetHotbed}
        cor={p.mesa}
        desactivado={!ligada}
      />
      <CartaoTemperatura
        rotulo={t('comum.camara')}
        valor={escolhida.status?.TempOfBox}
        alvo={escolhida.status?.TempTargetBox}
        cor={p.camara}
        desactivado={!ligada}
      />
    </View>
  );

  const blocoSlots = resina ? null : (
    <View
      style={{
        gap: espaco.sm,
        padding: espaco.md,
        borderRadius: raio.cartao,
        backgroundColor: p.cartao,
        borderWidth: 1,
        borderColor: p.contorno,
      }}
    >
      <Text style={{ ...tipos.microForte, color: p.textoSecundario }}>
        {t('inicio.slotsCanvas')}
      </Text>
      <SlotsCanvas
        slots={vistasSlots}
        carregando={slots === null && ligada}
        onSlot={irParaFilamentos}
      />
    </View>
  );

  const blocoAcoes = temTrabalho ? (
    <View style={{ flexDirection: 'row', gap: espaco.sm }}>
      <TouchableOpacity
        onPress={() =>
          acao(escolhida, estado === 'pausada' ? 'retomar' : 'pausar')
        }
        accessibilityRole="button"
        style={{
          flex: 1,
          height: 46,
          borderRadius: raio.botao,
          backgroundColor: p.cartaoAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ ...tipos.botao, fontSize: 15, color: p.texto }}>
          {estado === 'pausada' ? t('comum.retomar') : t('comum.pausar')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => acao(escolhida, 'parar')}
        accessibilityRole="button"
        style={{
          flex: 1,
          height: 46,
          borderRadius: raio.botao,
          borderWidth: 1.5,
          borderColor: p.perigo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ ...tipos.botao, fontSize: 15, color: p.perigo }}>
          {t('comum.parar')}
        </Text>
      </TouchableOpacity>
    </View>
  ) : null;

  const blocoConsumivel =
    rolo || garrafa ? (
      <LinhaConsumivel
        icone={rolo ? 'ellipse-outline' : 'water-outline'}
        nome={rolo ? rolo.nome : (garrafa?.nome ?? '')}
        detalhe={
          rolo
            ? `${rolo.material} · ${Math.round(rolo.restante)} g de ${
                rolo.pesoInicial
              } g · ${euros(custoPorGrama(rolo) * 1000)}/kg`
            : `${Math.round(garrafa?.restante ?? 0)} ml de ${
                garrafa?.volumeInicial ?? 0
              } ml`
        }
        cor={rolo?.cor}
        onPress={() => navigation.navigate('Inventario')}
      />
    ) : null;

  const atalhos = [
    !resina && {
      icone: 'videocam-outline' as const,
      etiqueta: t('inicio.camara'),
      aoTocar: abrirCamara,
    },
    {
      icone: 'folder-open-outline' as const,
      etiqueta: t('inicio.ficheiros'),
      aoTocar: irParaFicheiros,
    },
    {
      icone: 'stats-chart-outline' as const,
      etiqueta: t('history.title'),
      aoTocar: () => navigation.navigate('History'),
    },
    {
      icone: 'layers-outline' as const,
      etiqueta: t('inicio.inventario'),
      aoTocar: () => navigation.navigate('Inventario'),
    },
  ].filter(Boolean) as {
    icone: keyof typeof Ionicons.glyphMap;
    etiqueta: string;
    aoTocar: () => void;
  }[];

  const blocoAtalhos = (
    <View style={{ flexDirection: 'row', gap: espaco.sm }}>
      {atalhos.map(item => (
        <TouchableOpacity
          key={item.etiqueta}
          onPress={item.aoTocar}
          accessibilityRole="button"
          accessibilityLabel={item.etiqueta}
          style={{
            flex: 1,
            height: 64,
            borderRadius: raio.interno,
            backgroundColor: p.cartao,
            borderWidth: 1,
            borderColor: p.contorno,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Ionicons name={item.icone} size={19} color={p.primaria} />
          <Text numberOfLines={1} style={{ ...tipos.micro, color: p.texto }}>
            {item.etiqueta}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const blocoHistorico = (
    <ListaHistorico
      registos={historicoDaMaquina}
      onVerTudo={() => navigation.navigate('History')}
      limite={duasColunas ? 6 : 4}
    />
  );

  const blocoFila = (
    <CartaoFila
      mostrarAuto={false}
      onAbrir={() => navigation.navigate('Fila')}
    />
  );

  const blocoOutras = outras.length ? (
    <View style={{ gap: espaco.sm }}>
      {outras.map(maquina => (
        <TouchableOpacity
          key={maquina.id}
          onPress={() => setEscolhidaId(maquina.id)}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espaco.md,
            padding: espaco.md,
            borderRadius: raio.cartao,
            backgroundColor: p.cartao,
            borderWidth: 1,
            borderColor: p.contorno,
          }}
        >
          <Ionicons
            name={
              (maquina.kind ?? 'fdm') === 'resin'
                ? 'layers-outline'
                : 'print-outline'
            }
            size={17}
            color={p.textoSecundario}
          />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ ...tipos.legendaForte, color: p.texto }}
            >
              {maquina.printerName}
            </Text>
            <Text style={{ ...tipos.micro, color: p.textoSecundario }}>
              {maquina.connectionStatus !== 'connected'
                ? t('inicio.semLigacao')
                : maquina.status?.PrintInfo?.Filename
                  ? `${t('estado.imprimindo')} · ${Math.round(
                      maquina.status.PrintInfo.Progress ?? 0
                    )}%`
                  : t('inicio.pronta')}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={p.textoSecundario}
          />
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.fundo }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: duasColunas ? 40 : 110 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: margemEcra,
            paddingTop: espaco.sm,
          }}
        >
          <Text style={{ flex: 1, ...tipos.tituloEcra, color: p.texto }}>
            {t('inicio.titulo')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEditPrinter')}
            accessibilityRole="button"
            accessibilityLabel={t('home.adicionarImpressora')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: p.cartao,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color={p.texto} />
          </TouchableOpacity>
        </View>

        <View
          style={{
            paddingHorizontal: margemEcra,
            marginTop: espaco.md,
            gap: espaco.md,
          }}
        >
          <CabecalhoImpressora
            nome={escolhida.printerName}
            estado={estado}
            ip={escolhida.ipAddress}
            atualizadoEm={escolhida.lastUpdate}
            textoEstado={
              resina && estado === 'pronta'
                ? t('inicio.prontaResina')
                : undefined
            }
          />

          {blocoSeletor}

          {duasColunas ? (
            <View
              style={{
                flexDirection: 'row',
                gap: espaco.md,
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1.15, gap: espaco.md }}>
                {blocoCamara}
                {blocoTrabalho}
                {blocoAtalhos}
                {blocoHistorico}
              </View>
              <View style={{ flex: 1, gap: espaco.md }}>
                {blocoAnel}
                {blocoTemperaturas}
                {blocoSlots}
                {blocoAcoes}
                {blocoFila}
                {blocoConsumivel}
                {blocoOutras}
              </View>
            </View>
          ) : (
            <View style={{ gap: espaco.md }}>
              {blocoAnel}
              {blocoTrabalho}
              {blocoCamara}
              {blocoTemperaturas}
              {blocoAcoes}
              {blocoOutras}
              {blocoConsumivel}
              {blocoAtalhos}
              {blocoHistorico}
              {blocoFila}
              {blocoSlots}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
