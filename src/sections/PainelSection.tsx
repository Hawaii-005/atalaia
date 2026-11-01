import { fonteNumeros } from '~/theme/tokensV6';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { anel, espaco, raio as raioToken } from '../theme/tokensV6';
import { t, useIdioma } from '../i18n';
import { getPrintStatus, Printer } from '../types';
import { htmlDoVideo } from '../utils/cameraStream';
import { CartaoMovimento } from '../screens/controlos/CartaoMovimento';
import { CartaoVentilacao } from '../screens/controlos/CartaoVentilacao';
import { CartaoTemperaturas } from '../screens/controlos/CartaoTemperaturas';
import {
  LIMITE_ESTADO_ANTIGO_MS,
  controlosDisponiveis,
} from '../utils/controlos/capacidades';
import { estadoDeInfo } from '../utils/controlos/estado';
import { Preset } from '../utils/controlos/temperaturas';
import {
  CHAVE_PASSO,
  PassoMm,
  lerPassos,
  zPrecisaConfirmacao,
} from '../utils/controlos/passo';
import {
  ESPERA_ACK_MS,
  ResultadoComando,
  resultadoDeAck,
  resultadoDeFalha,
} from '../utils/controlos/resultado';
import { enderecoDe } from '../utils/rede';
import {
  ackDaResposta,
  fanCommand,
  homeCommand,
  jogCommand,
  lightCommand,
  pausePrintCommand,
  printSpeedCommand,
  resumePrintCommand,
  stopPrintCommand,
  temperatureCommand,
} from '../utils/commands';

const CAIXA = anel.grande.caixa;
const RAIO = anel.grande.raio;
const TRACO = anel.grande.traco;
const PERIMETRO = 2 * Math.PI * RAIO;

const PRESETS = [
  { nome: 'PLA', bico: 210, mesa: 60 },
  { nome: 'PETG', bico: 240, mesa: 80 },
  { nome: 'ABS', bico: 260, mesa: 100 },
];

const PASSOS = [0.1, 1, 10, 50];

const restante = (segundos: number) => {
  if (!segundos || segundos <= 0) return null;
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

/** Anel de progresso com o mesmo desenho do resto da app. */
const Anel: React.FC<{
  progresso: number;
  cor: string;
  trilho: string;
  children: React.ReactNode;
  imagem?: React.ReactNode;
}> = ({ progresso, cor, trilho, children, imagem }) => (
  <View
    style={{
      width: CAIXA,
      height: CAIXA,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Svg width={CAIXA} height={CAIXA} style={{ position: 'absolute' }}>
      <Circle
        cx={CAIXA / 2}
        cy={CAIXA / 2}
        r={RAIO}
        stroke={trilho}
        strokeWidth={TRACO}
        fill="none"
      />
      <Circle
        cx={CAIXA / 2}
        cy={CAIXA / 2}
        r={RAIO}
        stroke={cor}
        strokeWidth={TRACO}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={PERIMETRO}
        strokeDashoffset={
          PERIMETRO * (1 - Math.max(0, Math.min(100, progresso)) / 100)
        }
        transform={`rotate(-90 ${CAIXA / 2} ${CAIXA / 2})`}
      />
    </Svg>
    {imagem}
    <View style={{ alignItems: 'center' }}>{children}</View>
  </View>
);

const Cartao: React.FC<{ children: React.ReactNode; style?: object }> = ({
  children,
  style,
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <View
      style={[
        {
          backgroundColor: hexDe(p.cartao),
          borderRadius: raioToken.cartao,
          borderWidth: 1,
          borderColor: hexDe(p.linha),
          padding: espaco.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const Rotulo: React.FC<{ children: React.ReactNode; style?: object }> = ({
  children,
  style,
}) => {
  const { tema } = useTheme();
  return (
    <Text
      style={[
        {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: hexDe(tema.paleta.tintaSoft),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

/**
 * Painel Geral: estado e controlos num só ecrã contínuo.
 *
 * A máquina decide o que aparece: a imprimir mostra trabalho, velocidade,
 * ventoinhas e babystep de Z (X/Y travados); em espera mostra pré-aquecimento
 * e o D-Pad completo.
 */
export const PainelSection = ({
  printer,
  onAbrirCamara,
}: {
  printer?: Printer;
  onAbrirCamara?: () => void;
}) => {
  useIdioma();
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { request } = usePrinterConnections();
  const navigation = useNavigation<any>();
  const emFoco = useIsFocused();

  const ligada = printer?.connectionStatus === 'connected';
  const info = printer?.status?.PrintInfo;
  const statusBase = getPrintStatus(info?.Status ?? 0);
  const temFicheiro = !!info?.Filename;
  const aImprimir =
    ligada &&
    temFicheiro &&
    (statusBase === 'printing' || statusBase === 'preparing');
  const resina = (printer?.kind ?? 'fdm') === 'resin';

  const luz = !!printer?.status?.LightStatus?.SecondLight;
  const velocidade = printer?.status?.PrintInfo?.PrintSpeedPct ?? 100;
  const ventoinhas = printer?.status?.CurrentFanSpeed ?? {
    ModelFan: 0,
    AuxiliaryFan: 0,
    BoxFan: 0,
  };

  const progresso = info?.Progress ?? 0;
  const segundosRestantes = restante(
    (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0)
  );

  // A pausa não muda o código de estado: o sinal é o CurrentTicks parar. Só se
  // mostra «Retomar» depois de duas leituras iguais e 45 s parados.
  const ticksRef = useRef({ valor: -1, desde: Date.now(), iguais: 0 });
  const [emPausa, setEmPausa] = useState(false);
  useEffect(() => {
    const valor = info?.CurrentTicks ?? 0;
    const agora = Date.now();
    if (valor !== ticksRef.current.valor) {
      ticksRef.current = { valor, desde: agora, iguais: 0 };
      setEmPausa(false);
      return;
    }
    ticksRef.current.iguais += 1;
    if (
      aImprimir &&
      ticksRef.current.iguais >= 2 &&
      agora - ticksRef.current.desde > 45000
    ) {
      setEmPausa(true);
    }
  }, [info?.CurrentTicks, aImprimir]);

  const [passo, setPasso] = useState<PassoMm>(10);
  const [aEnviar, setAEnviar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoComando | null>(null);
  // Só para o estado «antigo» envelhecer no ecrã sem depender de pacotes novos.
  const [agora, setAgora] = useState(Date.now());
  const ocupada = aImprimir;

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 5000);
    return () => clearInterval(relogio);
  }, []);

  useEffect(() => {
    if (!printer?.id) return;
    let vivo = true;
    AsyncStorage.getItem(CHAVE_PASSO)
      .then(cru => {
        if (!vivo || !cru) return;
        setPasso(lerPassos(JSON.parse(cru))[printer.id] ?? 10);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [printer?.id]);

  const escolherPasso = useCallback(
    (novo: PassoMm) => {
      setPasso(novo);
      if (!printer?.id) return;
      AsyncStorage.getItem(CHAVE_PASSO)
        .then(cru => {
          const mapa = lerPassos(cru ? JSON.parse(cru) : {});
          mapa[printer.id] = novo;
          return AsyncStorage.setItem(CHAVE_PASSO, JSON.stringify(mapa));
        })
        .catch(() => undefined);
    },
    [printer?.id]
  );

  const moverZOffset = (mm: number) => {
    if (!printer) return;
    executar(jogCommand('Z', mm, { id: printer.id }));
  };

  const posicao = useMemo(() => {
    const numeros = (printer?.status?.CurrenCoord ?? '').match(
      /-?\d+(?:\.\d+)?/g
    );
    if (!numeros || numeros.length < 3) return null;
    return { x: numeros[0], y: numeros[1], z: numeros[2] };
  }, [printer?.status?.CurrenCoord]);

  const idadeEstado = printer?.lastUpdate ? agora - printer.lastUpdate : null;
  const estado = estadoDeInfo(
    info?.Status,
    ligada,
    idadeEstado,
    emPausa ? 60_000 : 0
  );
  const modelo = printer?.kind === 'resin' ? 'resina' : 'fdm';
  const disp = controlosDisponiveis(modelo, estado, {
    ligada,
    idadeEstadoMs: idadeEstado,
  });

  const enviar = useCallback(
    async (cmd: any, avisar = true) => {
      if (!printer) return;
      try {
        await request(printer.id, cmd, 8000);
      } catch (e) {
        if (avisar)
          Alert.alert(
            t('comum.erro'),
            e instanceof Error ? e.message : String(e)
          );
      }
    },
    [printer, request]
  );

  /** Envia um comando e traduz o Ack; desativa o bloco enquanto espera. */
  const executar = useCallback(
    async (cmd: any) => {
      if (!printer || aEnviar) return;
      setAEnviar(true);
      setResultado(null);
      try {
        const resposta = await request(printer.id, cmd, ESPERA_ACK_MS);
        setResultado(resultadoDeAck(ackDaResposta(resposta)));
      } catch (e) {
        setResultado(resultadoDeFalha(e));
      } finally {
        setAEnviar(false);
      }
    },
    [printer, request, aEnviar]
  );

  const mover = (eixo: 'X' | 'Y' | 'Z', sentido: 1 | -1) => {
    if (!printer) return;
    const mm = passo;
    const enviarMovimento = () =>
      executar(jogCommand(eixo, sentido * mm, { id: printer.id }));

    if (eixo === 'Z' && zPrecisaConfirmacao(mm, sentido)) {
      Alert.alert(
        t('controlos.confirmarZ', { passo: `${mm} mm` }),
        t('controlos.confirmarZMsg'),
        [
          { text: t('comum.cancelar'), style: 'cancel' },
          {
            text: t('comum.confirmar'),
            style: 'destructive',
            onPress: enviarMovimento,
          },
        ]
      );
      return;
    }
    enviarMovimento();
  };

  const fazerHome = (eixo: 'XYZ' | 'XY' | 'Z') => {
    if (!printer) return;
    const enviarHome = async () => {
      if (eixo === 'XY') {
        await executar(homeCommand('X', { id: printer.id }));
        await new Promise(r => setTimeout(r, 1200));
        await executar(homeCommand('Y', { id: printer.id }));
        return;
      }
      await executar(homeCommand(eixo, { id: printer.id }));
    };
    Alert.alert(t('controlos.confirmarHome'), t('controlos.confirmarHomeMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('comum.confirmar'),
        style: 'destructive',
        onPress: enviarHome,
      },
    ]);
  };

  const alternarPausa = () => {
    if (!printer) return;
    enviar(
      emPausa
        ? resumePrintCommand({ id: printer.id })
        : pausePrintCommand({ id: printer.id })
    );
  };

  const pedirParar = () => {
    Alert.alert(t('comum.cancelarImpressao'), t('comum.interrompeImpressao'), [
      { text: t('comum.continuarImpressao'), style: 'cancel' },
      {
        text: t('comum.cancelarImpressao'),
        style: 'destructive',
        onPress: () => enviar(stopPrintCommand({ id: printer?.id })),
      },
    ]);
  };

  const definirVentoinha = (
    campo: 'model' | 'side' | 'chamber',
    valor: number
  ) => {
    enviar(
      fanCommand(
        {
          model: campo === 'model' ? valor : (ventoinhas.ModelFan ?? 0),
          side: campo === 'side' ? valor : (ventoinhas.AuxiliaryFan ?? 0),
          chamber: campo === 'chamber' ? valor : (ventoinhas.BoxFan ?? 0),
        },
        { id: printer?.id }
      )
    );
  };

  const aplicarTemperaturas = (preset: Preset, material: string) => {
    Alert.alert(
      t('controlos.confirmarTemperaturas', { material }),
      t('controlos.confirmarTemperaturasMsg', {
        bico: String(preset.bico),
        mesa: String(preset.mesa),
      }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('comum.confirmar'),
          onPress: () =>
            enviar(
              temperatureCommand(
                { nozzle: preset.bico, bed: preset.mesa },
                { id: printer?.id }
              )
            ),
        },
      ]
    );
  };

  const arrefecer = () =>
    Alert.alert(t('controlos.arrefecer'), t('controlos.arrefecerMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('comum.confirmar'),
        onPress: () =>
          enviar(
            temperatureCommand(
              { nozzle: 0, bed: 0, chamber: 0 },
              { id: printer?.id }
            )
          ),
      },
    ]);

  const definirVelocidade = (pct: number) =>
    enviar(printSpeedCommand(pct, { id: printer?.id }));

  const preAquecer = (bico: number, mesa: number) =>
    Alert.alert(
      `${t('painel.preAquecer')} · ${bico}° / ${mesa}°`,
      t('painel.preAquecerMsg'),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('comum.confirmar'),
          onPress: () =>
            enviar(
              temperatureCommand(
                { nozzle: bico, bed: mesa },
                { id: printer?.id }
              )
            ),
        },
      ]
    );

  // Sem ligação não há painel: mostra-se o que o resto da app já diz.
  if (!printer) {
    return (
      <View style={{ padding: espaco.lg }}>
        <Text style={{ color: hexDe(paleta.tintaSoft), fontSize: 13 }}>
          {t('filamentos.semMaquina')}
        </Text>
      </View>
    );
  }

  if (resina) {
    return (
      <ScrollView
        contentContainerStyle={{
          padding: espaco.lg,
          gap: espaco.md,
          paddingBottom: 32,
        }}
      >
        <Cartao>
          <Rotulo>{t('secao.estado')}</Rotulo>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: hexDe(paleta.tinta),
              marginTop: 6,
            }}
          >
            {info?.Filename || printer.printerName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: hexDe(paleta.tintaSoft),
              marginTop: 4,
            }}
          >
            {ligada ? t('inicio.pronta') : t('inicio.semLigacao')}
          </Text>
          <TouchableOpacity
            onPress={pedirParar}
            disabled={!temFicheiro}
            style={{
              marginTop: espaco.md,
              height: 46,
              borderRadius: raioToken.botao,
              borderWidth: 1.5,
              borderColor: hexDe(paleta.perigo),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: temFicheiro ? 1 : 0.4,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: hexDe(paleta.perigo),
              }}
            >
              {t('comum.parar')}
            </Text>
          </TouchableOpacity>
        </Cartao>
      </ScrollView>
    );
  }

  const corEstado = !ligada
    ? hexDe(paleta.perigo)
    : aImprimir
      ? hexDe(paleta.ok)
      : hexDe(paleta.acento);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: espaco.lg,
        gap: espaco.md,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* câmara */}
      {emFoco && ligada && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onAbrirCamara}
          style={{
            borderRadius: raioToken.cartao,
            overflow: 'hidden',
            aspectRatio: 16 / 9,
            backgroundColor: '#000',
          }}
        >
          <WebView
            key={`cam-${printer.id}`}
            source={{
              html: htmlDoVideo(enderecoDe(printer), 'cover', false),
              baseUrl: `http://${enderecoDe(printer)}`,
            }}
            style={{ flex: 1, backgroundColor: '#000' }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled={false}
            mixedContentMode="always"
            originWhitelist={['*']}
            scrollEnabled={false}
            bounces={false}
            pointerEvents="none"
          />

          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(5,8,15,0.72)',
              borderRadius: 9,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: aImprimir
                  ? hexDe(paleta.perigo)
                  : hexDe(paleta.tintaSoft),
              }}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: '#E7EDF9',
                letterSpacing: 0.4,
              }}
            >
              {t('painel.emDireto')}
            </Text>
          </View>

          <TouchableOpacity
            disabled={disp.luz.estado === 'desactivado'}
            onPress={() => enviar(lightCommand(!luz, { id: printer.id }))}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 40,
              height: 40,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: luz
                ? 'rgba(251,191,36,0.24)'
                : 'rgba(5,8,15,0.66)',
              borderWidth: 1,
              borderColor: luz
                ? 'rgba(251,191,36,0.6)'
                : 'rgba(255,255,255,0.16)',
            }}
            accessibilityLabel={t('controlos.luz')}
          >
            <Ionicons
              name={luz ? 'bulb' : 'bulb-outline'}
              size={18}
              color={luz ? hexDe(paleta.aviso) : '#DCE5F5'}
            />
          </TouchableOpacity>

          <View
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              backgroundColor: 'rgba(5,8,15,0.72)',
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 10, color: '#C9D4EA' }}>
              {temFicheiro
                ? `${t('detalhes.camada')} ${info?.CurrentLayer ?? 0}/${info?.TotalLayer ?? 0}`
                : t('inicio.pronta')}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* trabalho ou espera */}
      {aImprimir ? (
        <Cartao>
          <View
            style={{
              flexDirection: 'row',
              gap: espaco.lg,
              alignItems: 'center',
            }}
          >
            <Anel
              progresso={progresso}
              cor={hexDe(paleta.acento)}
              trilho={hexDe(paleta.linha)}
            >
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '700',
                  color: hexDe(paleta.tinta),
                  fontFamily: fonteNumeros,
                }}
              >
                {Math.round(progresso)}%
              </Text>
            </Anel>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: corEstado,
                  letterSpacing: 0.6,
                }}
              >
                {emPausa
                  ? t('estado.emPausa').toUpperCase()
                  : t('estado.imprimindo').toUpperCase()}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: hexDe(paleta.tinta),
                  marginTop: 4,
                }}
              >
                {info?.Filename}
              </Text>
              <View
                style={{ flexDirection: 'row', gap: espaco.md, marginTop: 8 }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: hexDe(paleta.tinta),
                      fontFamily: fonteNumeros,
                    }}
                  >
                    {`${info?.CurrentLayer ?? 0}/${info?.TotalLayer ?? 0}`}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}
                  >
                    {t('detalhes.camada')}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: hexDe(paleta.tinta),
                      fontFamily: fonteNumeros,
                    }}
                  >
                    {segundosRestantes ?? '—'}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}
                  >
                    {t('painel.restante')}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: hexDe(paleta.tinta),
                      fontFamily: fonteNumeros,
                    }}
                  >
                    {`${Math.round(velocidade)}%`}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}
                  >
                    {t('controlos.velocidade')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: espaco.sm,
              marginTop: espaco.md,
            }}
          >
            <TouchableOpacity
              onPress={alternarPausa}
              style={{
                flex: 1,
                height: 48,
                borderRadius: raioToken.botao,
                backgroundColor: hexDe(paleta.fundoBaixo),
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 7,
              }}
            >
              <Ionicons
                name={emPausa ? 'play' : 'pause'}
                size={15}
                color={hexDe(paleta.tinta)}
              />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: hexDe(paleta.tinta),
                }}
              >
                {emPausa ? t('comum.retomar') : t('comum.pausar')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pedirParar}
              style={{
                flex: 1,
                height: 48,
                borderRadius: raioToken.botao,
                borderWidth: 1.5,
                borderColor: hexDe(paleta.perigo),
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 7,
              }}
            >
              <Ionicons name="stop" size={15} color={hexDe(paleta.perigo)} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: hexDe(paleta.perigo),
                }}
              >
                {t('comum.parar')}
              </Text>
            </TouchableOpacity>
          </View>
        </Cartao>
      ) : (
        <Cartao>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: espaco.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Rotulo>{t('painel.emEspera')}</Rotulo>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: hexDe(paleta.tinta),
                  marginTop: 5,
                }}
              >
                {ligada ? t('inicio.pronta') : t('inicio.semLigacao')}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: hexDe(paleta.tintaSoft),
                  marginTop: 3,
                }}
              >
                {ligada ? t('painel.prontaMsg') : t('painel.semLigacaoMsg')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('AddEditPrinter', { printerId: printer.id })
              }
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: hexDe(paleta.fundoBaixo),
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel={t('comum.editar')}
            >
              <Ionicons
                name="create-outline"
                size={17}
                color={hexDe(paleta.tintaSoft)}
              />
            </TouchableOpacity>
          </View>

          <Rotulo style={{ marginTop: espaco.md, marginBottom: espaco.sm }}>
            {t('painel.preAquecer')}
          </Rotulo>
          <View style={{ flexDirection: 'row', gap: espaco.sm }}>
            {PRESETS.map(p => (
              <TouchableOpacity
                key={p.nome}
                disabled={!ligada}
                onPress={() => preAquecer(p.bico, p.mesa)}
                style={{
                  flex: 1,
                  borderRadius: raioToken.interno,
                  backgroundColor: hexDe(paleta.fundoBaixo),
                  borderWidth: 1,
                  borderColor: hexDe(paleta.linha),
                  paddingVertical: 11,
                  alignItems: 'center',
                  opacity: ligada ? 1 : 0.4,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: hexDe(paleta.tinta),
                  }}
                >
                  {p.nome}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: hexDe(paleta.tintaSoft),
                    marginTop: 2,
                  }}
                >
                  {`${p.bico}° · ${p.mesa}°`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Cartao>
      )}

      {/* térmica */}
      <Cartao>
        <CartaoTemperaturas
          atual={{
            bico: printer.status?.TempOfNozzle ?? 0,
            mesa: printer.status?.TempOfHotbed ?? 0,
          }}
          disp={disp}
          onAplicar={aplicarTemperaturas}
          onArrefecer={arrefecer}
        />
      </Cartao>

      {/* velocidade e ventoinhas só com trabalho a correr */}
      {aImprimir && (
        <Cartao>
          <CartaoVentilacao
            ventoinhas={{
              model: ventoinhas.ModelFan ?? 0,
              side: ventoinhas.AuxiliaryFan ?? 0,
              chamber: ventoinhas.BoxFan ?? 0,
            }}
            velocidade={velocidade}
            disp={disp}
            onVentoinha={definirVentoinha}
            onVelocidade={definirVelocidade}
          />
        </Cartao>
      )}

      {/* eixos: babystep a imprimir, D-Pad em espera */}
      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Rotulo style={{ flex: 1 }}>{t('controlos.movimento')}</Rotulo>
          {aImprimir && (
            <View
              style={{
                backgroundColor: hexDe(paleta.aviso) + '22',
                borderRadius: 7,
                paddingHorizontal: 7,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: hexDe(paleta.aviso),
                }}
              >
                {t('painel.xyBloqueados')}
              </Text>
            </View>
          )}
        </View>

        {aImprimir ? (
          <>
            <Text
              style={{
                fontSize: 11,
                color: hexDe(paleta.tintaSoft),
                marginTop: 6,
              }}
            >
              {t('painel.babystepMsg')}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                gap: espaco.sm,
                marginTop: espaco.md,
              }}
            >
              {[-0.02, 0, 0.02].map((mm, i) => {
                const centro = i === 1;
                return (
                  <TouchableOpacity
                    key={mm}
                    disabled={centro}
                    onPress={() => moverZOffset(mm)}
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: raioToken.interno,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: centro
                        ? hexDe(paleta.acento) + '22'
                        : hexDe(paleta.fundoBaixo),
                      borderWidth: 1,
                      borderColor: centro
                        ? hexDe(paleta.acento) + '77'
                        : hexDe(paleta.linha),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        fontFamily: fonteNumeros,
                        color: centro
                          ? hexDe(paleta.acentoTexto)
                          : hexDe(paleta.tinta),
                      }}
                    >
                      {centro
                        ? `${(printer.status?.ZOffset ?? 0).toFixed(2)} mm`
                        : `${mm > 0 ? '+' : ''}${mm.toFixed(2)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <CartaoMovimento
            posicao={posicao}
            passo={passo}
            onPasso={escolherPasso}
            disp={disp}
            aEnviar={aEnviar}
            resultado={resultado}
            onMover={mover}
            onHome={fazerHome}
          />
        )}
      </Cartao>
    </ScrollView>
  );
};

/** Tecla do D-Pad. */
const Tecla: React.FC<{
  etiqueta: string;
  onPress: () => void;
  desactivado?: boolean;
  largo?: boolean;
}> = ({ etiqueta, onPress, desactivado, largo }) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desactivado}
      activeOpacity={0.75}
      style={{
        width: largo ? undefined : 46,
        flex: largo ? 1 : undefined,
        height: 46,
        paddingHorizontal: largo ? 10 : 0,
        borderRadius: 14,
        borderWidth: 1.2,
        borderColor: hexDe(p.linha),
        backgroundColor: hexDe(p.fundoBaixo),
        alignItems: 'center',
        justifyContent: 'center',
        opacity: desactivado ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: hexDe(p.tinta) }}>
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );
};
