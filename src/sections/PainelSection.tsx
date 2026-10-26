import { fonteNumeros } from '~/theme/tokensV6';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { anel, espaco, raio as raioToken } from '../theme/tokensV6';
import { t } from '../i18n';
import { getPrintStatus, Printer } from '../types';
import { htmlDoVideo } from '../utils/cameraStream';
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
const Anel: React.FC<{ progresso: number; cor: string; trilho: string; children: React.ReactNode; imagem?: React.ReactNode }> = ({
  progresso,
  cor,
  trilho,
  children,
  imagem,
}) => (
  <View style={{ width: CAIXA, height: CAIXA, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={CAIXA} height={CAIXA} style={{ position: 'absolute' }}>
      <Circle cx={CAIXA / 2} cy={CAIXA / 2} r={RAIO} stroke={trilho} strokeWidth={TRACO} fill="none" />
      <Circle
        cx={CAIXA / 2}
        cy={CAIXA / 2}
        r={RAIO}
        stroke={cor}
        strokeWidth={TRACO}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={PERIMETRO}
        strokeDashoffset={PERIMETRO * (1 - Math.max(0, Math.min(100, progresso)) / 100)}
        transform={`rotate(-90 ${CAIXA / 2} ${CAIXA / 2})`}
      />
    </Svg>
    {imagem}
    <View style={{ alignItems: 'center' }}>{children}</View>
  </View>
);

const Cartao: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => {
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

const Rotulo: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => {
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
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { request } = usePrinterConnections();
  const navigation = useNavigation<any>();
  const emFoco = useIsFocused();

  const ligada = printer?.connectionStatus === 'connected';
  const info = printer?.status?.PrintInfo;
  const statusBase = getPrintStatus(info?.Status ?? 0);
  const temFicheiro = !!info?.Filename;
  const aImprimir = ligada && temFicheiro && (statusBase === 'printing' || statusBase === 'preparing');
  const resina = (printer?.kind ?? 'fdm') === 'resin';

  const luz = !!printer?.status?.LightStatus?.SecondLight;
  const velocidade = printer?.status?.PrintInfo?.PrintSpeedPct ?? 100;
  const ventoinhas = printer?.status?.CurrentFanSpeed ?? { ModelFan: 0, AuxiliaryFan: 0, BoxFan: 0 };

  const progresso = info?.Progress ?? 0;
  const segundosRestantes = restante((info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0));

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
    if (aImprimir && ticksRef.current.iguais >= 2 && agora - ticksRef.current.desde > 45000) {
      setEmPausa(true);
    }
  }, [info?.CurrentTicks, aImprimir]);

  const [passo, setPasso] = useState(10);
  const ocupada = aImprimir;

  const enviar = useCallback(
    async (cmd: any, avisar = true) => {
      if (!printer) return;
      try {
        await request(printer.id, cmd, 8000);
      } catch (e) {
        if (avisar) Alert.alert(t('comum.erro'), e instanceof Error ? e.message : String(e));
      }
    },
    [printer, request]
  );

  const mover = async (eixo: 'X' | 'Y' | 'Z', sentido: 1 | -1, mm?: number) => {
    if (!printer) return;
    try {
      const resposta = await request(
        printer.id,
        jogCommand(eixo, sentido * (mm ?? passo), { id: printer.id }),
        8000
      );
      if (ackDaResposta(resposta) === 3) {
        Alert.alert(t('controlos.movimento'), t('controlos.precisaHome'));
      }
    } catch (e) {
      Alert.alert(t('comum.erro'), e instanceof Error ? e.message : String(e));
    }
  };

  const fazerHome = (eixo: 'XYZ' | 'Z') => {
    Alert.alert(t('controlos.confirmarHome'), t('controlos.confirmarHomeMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('comum.confirmar'),
        style: 'destructive',
        onPress: () => enviar(homeCommand(eixo, { id: printer?.id })),
      },
    ]);
  };

  const fazerHomeXY = () => {
    Alert.alert(t('controlos.confirmarHome'), t('controlos.confirmarHomeMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('comum.confirmar'),
        style: 'destructive',
        onPress: async () => {
          await enviar(homeCommand('X', { id: printer?.id }));
          await new Promise(r => setTimeout(r, 1200));
          await enviar(homeCommand('Y', { id: printer?.id }));
        },
      },
    ]);
  };

  const alternarPausa = () => {
    if (!printer) return;
    enviar(
      emPausa ? resumePrintCommand({ id: printer.id }) : pausePrintCommand({ id: printer.id })
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

  const alterarVentoinha = (campo: 'model' | 'side' | 'chamber', delta: number) => {
    const actual = {
      model: ventoinhas.ModelFan ?? 0,
      side: ventoinhas.AuxiliaryFan ?? 0,
      chamber: ventoinhas.BoxFan ?? 0,
    }[campo];
    const valor = Math.max(0, Math.min(100, actual + delta));
    enviar(
      fanCommand(
        {
          model: campo === 'model' ? valor : ventoinhas.ModelFan ?? 0,
          side: campo === 'side' ? valor : ventoinhas.AuxiliaryFan ?? 0,
          chamber: campo === 'chamber' ? valor : ventoinhas.BoxFan ?? 0,
        },
        { id: printer?.id }
      )
    );
  };

  const preAquecer = (bico: number, mesa: number) =>
    Alert.alert(
      `${t('painel.preAquecer')} · ${bico}° / ${mesa}°`,
      t('painel.preAquecerMsg'),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('comum.confirmar'),
          onPress: () =>
            enviar(temperatureCommand({ nozzle: bico, bed: mesa }, { id: printer?.id })),
        },
      ]
    );

  // Sem ligação não há painel: mostra-se o que o resto da app já diz.
  if (!printer) {
    return (
      <View style={{ padding: espaco.lg }}>
        <Text style={{ color: hexDe(paleta.tintaSoft), fontSize: 13 }}>{t('filamentos.semMaquina')}</Text>
      </View>
    );
  }

  if (resina) {
    return (
      <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.md, paddingBottom: 32 }}>
        <Cartao>
          <Rotulo>{t('secao.estado')}</Rotulo>
          <Text style={{ fontSize: 18, fontWeight: '700', color: hexDe(paleta.tinta), marginTop: 6 }}>
            {info?.Filename || printer.printerName}
          </Text>
          <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft), marginTop: 4 }}>
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
            <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.perigo) }}>
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
      contentContainerStyle={{ padding: espaco.lg, gap: espaco.md, paddingBottom: 40 }}
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
                backgroundColor: aImprimir ? hexDe(paleta.perigo) : hexDe(paleta.tintaSoft),
              }}
            />
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#E7EDF9', letterSpacing: 0.4 }}>
              {t('painel.emDireto')}
            </Text>
          </View>

          <TouchableOpacity
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
              backgroundColor: luz ? 'rgba(251,191,36,0.24)' : 'rgba(5,8,15,0.66)',
              borderWidth: 1,
              borderColor: luz ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.16)',
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
          <View style={{ flexDirection: 'row', gap: espaco.lg, alignItems: 'center' }}>
            <Anel progresso={progresso} cor={hexDe(paleta.acento)} trilho={hexDe(paleta.linha)}>
              <Text style={{ fontSize: 26, fontWeight: '700', color: hexDe(paleta.tinta), fontFamily: fonteNumeros }}>
                {Math.round(progresso)}%
              </Text>
            </Anel>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: corEstado, letterSpacing: 0.6 }}>
                {emPausa ? t('estado.emPausa').toUpperCase() : t('estado.imprimindo').toUpperCase()}
              </Text>
              <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta), marginTop: 4 }}>
                {info?.Filename}
              </Text>
              <View style={{ flexDirection: 'row', gap: espaco.md, marginTop: 8 }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta), fontFamily: fonteNumeros }}>
                    {`${info?.CurrentLayer ?? 0}/${info?.TotalLayer ?? 0}`}
                  </Text>
                  <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}>{t('detalhes.camada')}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta), fontFamily: fonteNumeros }}>
                    {segundosRestantes ?? '—'}
                  </Text>
                  <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}>{t('painel.restante')}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta), fontFamily: fonteNumeros }}>
                    {`${Math.round(velocidade)}%`}
                  </Text>
                  <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}>{t('controlos.velocidade')}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md }}>
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
              <Ionicons name={emPausa ? 'play' : 'pause'} size={15} color={hexDe(paleta.tinta)} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta) }}>
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
              <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.perigo) }}>
                {t('comum.parar')}
              </Text>
            </TouchableOpacity>
          </View>
        </Cartao>
      ) : (
        <Cartao>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espaco.sm }}>
            <View style={{ flex: 1 }}>
              <Rotulo>{t('painel.emEspera')}</Rotulo>
              <Text style={{ fontSize: 17, fontWeight: '700', color: hexDe(paleta.tinta), marginTop: 5 }}>
                {ligada ? t('inicio.pronta') : t('inicio.semLigacao')}
              </Text>
              <Text style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 3 }}>
                {ligada ? t('painel.prontaMsg') : t('painel.semLigacaoMsg')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddEditPrinter', { printerId: printer.id })}
              style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: hexDe(paleta.fundoBaixo), alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel={t('comum.editar')}
            >
              <Ionicons name="create-outline" size={17} color={hexDe(paleta.tintaSoft)} />
            </TouchableOpacity>
          </View>

          <Rotulo style={{ marginTop: espaco.md, marginBottom: espaco.sm }}>{t('painel.preAquecer')}</Rotulo>
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
                <Text style={{ fontSize: 12, fontWeight: '700', color: hexDe(paleta.tinta) }}>{p.nome}</Text>
                <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft), marginTop: 2 }}>
                  {`${p.bico}° · ${p.mesa}°`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Cartao>
      )}

      {/* térmica */}
      <Cartao>
        <Rotulo style={{ marginBottom: espaco.sm }}>{t('painel.temperaturas')}</Rotulo>
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {[
            { rotulo: t('comum.bico'), valor: printer.status?.TempOfNozzle ?? 0, alvo: printer.status?.TempTargetNozzle ?? 0, cor: hexDe(paleta.aviso) },
            { rotulo: t('comum.mesa'), valor: printer.status?.TempOfHotbed ?? 0, alvo: printer.status?.TempTargetHotbed ?? 0, cor: hexDe(paleta.acento) },
            { rotulo: t('comum.camara'), valor: printer.status?.TempOfBox ?? 0, alvo: printer.status?.TempTargetBox ?? 0, cor: hexDe(paleta.ok) },
          ].map(item => (
            <View
              key={item.rotulo}
              style={{
                flex: 1,
                backgroundColor: hexDe(paleta.fundoBaixo),
                borderRadius: raioToken.interno,
                paddingVertical: espaco.sm,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {item.rotulo}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: item.cor, fontFamily: fonteNumeros, marginTop: 3 }}>
                {`${Math.round(item.valor)}°`}
              </Text>
              <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft), fontFamily: fonteNumeros }}>
                {item.alvo > 0 ? `/ ${Math.round(item.alvo)}°` : t('painel.ambiente')}
              </Text>
            </View>
          ))}
        </View>
      </Cartao>

      {/* velocidade e ventoinhas só com trabalho a correr */}
      {aImprimir && (
        <Cartao>
          <Rotulo style={{ marginBottom: espaco.sm }}>{t('controlos.velocidade')}</Rotulo>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[50, 100, 150, 200].map(pct => {
              const activo = Math.round(velocidade) === pct;
              return (
                <TouchableOpacity
                  key={pct}
                  onPress={() => enviar(printSpeedCommand(pct, { id: printer.id }))}
                  disabled={!ligada}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: raioToken.chip,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: activo ? hexDe(paleta.acento) : hexDe(paleta.fundoBaixo),
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: activo ? '#fff' : hexDe(paleta.tinta) }}>
                    {`${pct}%`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Rotulo style={{ marginTop: espaco.md, marginBottom: espaco.sm }}>{t('controlos.ventoinhas')}</Rotulo>
          {[
            { rotulo: t('controlos.ventoinhaBico'), valor: ventoinhas.ModelFan ?? 0, campo: 'model' as const },
            { rotulo: t('controlos.ventoinhaAuxiliar'), valor: ventoinhas.AuxiliaryFan ?? 0, campo: 'side' as const },
            { rotulo: t('controlos.ventoinhaCaixa'), valor: ventoinhas.BoxFan ?? 0, campo: 'chamber' as const },
          ].map(v => (
            <View key={v.campo} style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm, marginBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: 13, color: hexDe(paleta.tinta) }}>{v.rotulo}</Text>
              <View style={{ width: 90, height: 5, borderRadius: 3, backgroundColor: hexDe(paleta.linha), overflow: 'hidden' }}>
                <View style={{ width: `${Math.max(0, Math.min(100, v.valor))}%`, height: 5, backgroundColor: hexDe(paleta.acento) }} />
              </View>
              <Text style={{ width: 40, textAlign: 'right', fontSize: 13, fontWeight: '700', color: hexDe(paleta.tinta), fontFamily: fonteNumeros }}>
                {`${Math.round(v.valor)}%`}
              </Text>
              <TouchableOpacity
                onPress={() => alterarVentoinha(v.campo, -10)}
                style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: hexDe(paleta.fundoBaixo), alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="remove" size={15} color={hexDe(paleta.tinta)} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => alterarVentoinha(v.campo, 10)}
                style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: hexDe(paleta.fundoBaixo), alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="add" size={15} color={hexDe(paleta.tinta)} />
              </TouchableOpacity>
            </View>
          ))}
        </Cartao>
      )}

      {/* eixos: babystep a imprimir, D-Pad em espera */}
      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Rotulo style={{ flex: 1 }}>{t('controlos.movimento')}</Rotulo>
          {aImprimir && (
            <View style={{ backgroundColor: hexDe(paleta.aviso) + '22', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: hexDe(paleta.aviso) }}>
                {t('painel.xyBloqueados')}
              </Text>
            </View>
          )}
        </View>

        {aImprimir ? (
          <>
            <Text style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 6 }}>
              {t('painel.babystepMsg')}
            </Text>
            <View style={{ flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md }}>
              {[-0.02, 0, 0.02].map((mm, i) => {
                const centro = i === 1;
                return (
                  <TouchableOpacity
                    key={mm}
                    disabled={centro}
                    onPress={() => mover('Z', mm > 0 ? 1 : -1, Math.abs(mm))}
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: raioToken.interno,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: centro ? hexDe(paleta.acento) + '22' : hexDe(paleta.fundoBaixo),
                      borderWidth: 1,
                      borderColor: centro ? hexDe(paleta.acento) + '77' : hexDe(paleta.linha),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        fontFamily: fonteNumeros,
                        color: centro ? hexDe(paleta.acentoTexto) : hexDe(paleta.tinta),
                      }}
                    >
                      {centro ? `${(printer.status?.ZOffset ?? 0).toFixed(2)} mm` : `${mm > 0 ? '+' : ''}${mm.toFixed(2)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: espaco.md, alignItems: 'center', marginTop: espaco.sm }}>
              {(['X', 'Y', 'Z'] as const).map((eixo, i) => {
                const numeros = (printer.status?.CurrenCoord ?? '').match(/-?\d+(?:\.\d+)?/g) ?? [];
                return (
                  <View key={eixo} style={{ flexDirection: 'row' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: hexDe(paleta.acento) }}>{`${eixo}: `}</Text>
                    <Text style={{ fontSize: 12, color: hexDe(paleta.tinta), fontFamily: fonteNumeros }}>
                      {numeros[i] ?? '0.00'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 6, marginTop: espaco.sm }}>
              {PASSOS.map(mm => (
                <TouchableOpacity
                  key={mm}
                  onPress={() => setPasso(mm)}
                  style={{
                    flex: 1,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: passo === mm ? hexDe(paleta.acento) : hexDe(paleta.fundoBaixo),
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: passo === mm ? '#fff' : hexDe(paleta.tintaSoft) }}>
                    {mm === 0.1 ? '0.1 mm' : `${mm} mm`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ alignItems: 'center', marginTop: espaco.md, gap: 6 }}>
              <Tecla etiqueta="▲" onPress={() => mover('Y', 1)} desactivado={ocupada || !ligada} />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Tecla etiqueta="◀" onPress={() => mover('X', -1)} desactivado={ocupada || !ligada} />
                <TouchableOpacity
                  onPress={() => fazerHome('XYZ')}
                  disabled={ocupada || !ligada}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    borderWidth: 1.5,
                    borderColor: hexDe(paleta.acento),
                    backgroundColor: hexDe(paleta.fundoBaixo),
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: ocupada || !ligada ? 0.4 : 1,
                  }}
                >
                  <Ionicons name="home" size={18} color={hexDe(paleta.tinta)} />
                </TouchableOpacity>
                <Tecla etiqueta="▶" onPress={() => mover('X', 1)} desactivado={ocupada || !ligada} />
              </View>
              <Tecla etiqueta="▼" onPress={() => mover('Y', -1)} desactivado={ocupada || !ligada} />
            </View>

            <View style={{ flexDirection: 'row', gap: 6, marginTop: espaco.sm }}>
              <Tecla etiqueta="Z ▲" onPress={() => mover('Z', 1)} desactivado={ocupada || !ligada} largo />
              <Tecla etiqueta="Z ▼" onPress={() => mover('Z', -1)} desactivado={ocupada || !ligada} largo />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <Tecla etiqueta="Home XY" onPress={fazerHomeXY} desactivado={ocupada || !ligada} largo />
              <Tecla etiqueta="Home Z" onPress={() => fazerHome('Z')} desactivado={ocupada || !ligada} largo />
            </View>
          </>
        )}
      </Cartao>
    </ScrollView>
  );
};

/** Tecla do D-Pad. */
const Tecla: React.FC<{ etiqueta: string; onPress: () => void; desactivado?: boolean; largo?: boolean }> = ({
  etiqueta,
  onPress,
  desactivado,
  largo,
}) => {
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
      <Text style={{ fontSize: 12, fontWeight: '700', color: hexDe(p.tinta) }}>{etiqueta}</Text>
    </TouchableOpacity>
  );
};
