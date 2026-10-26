import { fonteNumeros } from '~/theme/tokensV6';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { htmlDoVideo } from '../utils/cameraStream';
import { enderecoDe } from '../utils/rede';
import { extrairMiniaturaEmbutida, urlMiniatura } from '../utils/miniatura';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useNavigation } from '@react-navigation/native';
import { EstadoVazio } from '../ui/EstadoVazio';
import { Mascote } from '../ui/Mascote';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { anel, espaco, raio as raioToken } from '../theme/tokensV6';
import { t } from '../i18n';
import { getPrintStatus, Printer } from '../types';
import {
  pausePrintCommand,
  resumePrintCommand,
  stopPrintCommand,
  videoCommand,
} from '../utils/commands';

const CAIXA = anel.grande.caixa;
const RAIO = anel.grande.raio;
const TRACO = anel.grande.traco;
const PERIMETRO = 2 * Math.PI * RAIO;

const restante = (segundos: number) => {
  if (!segundos || segundos <= 0) return null;
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

const DIAMETRO_IMAGEM = 2 * (RAIO - TRACO / 2 - 2);

const Anel: React.FC<{
  progresso: number;
  cor: string;
  trilho: string;
  imagem?: React.ReactNode;
  children: React.ReactNode;
}> = ({ progresso, cor, trilho, imagem, children }) => (
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
    {imagem && (
      <View
        style={{
          position: 'absolute',
          width: CAIXA,
          height: CAIXA,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imagem}
      </View>
    )}
    {imagem && (
      <View
        style={{
          position: 'absolute',
          width: DIAMETRO_IMAGEM,
          height: DIAMETRO_IMAGEM,
          borderRadius: DIAMETRO_IMAGEM / 2,
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      />
    )}
    {children}
  </View>
);

export const EstadoSection = ({ printer, onAbrirCamara }: { printer?: Printer; onAbrirCamara?: () => void }) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { request, sendCommand, reconnectAll } = usePrinterConnections();
  const navigation = useNavigation<any>();

  const emFoco = useIsFocused();
  const info = printer?.status?.PrintInfo;
  const progresso = info?.Progress ?? 0;
  const ligada = printer?.connectionStatus === 'connected';
  // Marca se já houve ligação desde que o ecrã montou: o `status` fica guardado
  // entre arranques, por isso não serve para saber se é a primeira ligação.
  const jaLigouAntes = React.useRef(false);
  if (ligada) jaLigouAntes.current = true;
  const resina = (printer?.kind ?? 'fdm') === 'resin';

  const estado = useMemo(() => {
    if (!ligada) return { texto: t('inicio.semLigacao'), cor: hexDe(paleta.perigo) };
    if (!info?.Filename) return { texto: t('inicio.pronta'), cor: hexDe(paleta.ok) };
    const s = getPrintStatus(info.Status ?? 0);
    if (s === 'printing') return { texto: t('estado.imprimindo'), cor: hexDe(paleta.ok) };
    if (s === 'paused') return { texto: t('estado.emPausa'), cor: hexDe(paleta.aviso) };
    if (s === 'preparing') return { texto: t('estado.aPreparar'), cor: hexDe(paleta.aviso) };
    if (s === 'completed') return { texto: t('estado.terminada'), cor: hexDe(paleta.tintaSoft) };
    if (s === 'stopped') return { texto: t('estado.parada'), cor: hexDe(paleta.perigo) };
    return { texto: t('inicio.pronta'), cor: hexDe(paleta.ok) };
  }, [info, ligada, paleta]);

  const segundosRestantes = restante((info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0));

  // Cartão de fim de impressão: fecha-se, volta a aparecer na impressão seguinte.
  const chaveFim = `${info?.Filename ?? ''}|${info?.TotalTicks ?? 0}`;
  const [fimFechado, setFimFechado] = React.useState<string | null>(null);
  const concluido = getPrintStatus(info?.Status ?? 0) === 'completed' && !!info?.Filename;
  const duracao = restante(info?.TotalTicks ?? 0);

  // Resina: quando não responde pode ser rede, estar desligada — ou, o mais
  // comum, outro dispositivo com a app aberta. O SDCP da Saturn só aceita um
  // cliente de cada vez (do telemóvel, a porta 3000 dá 'connection refused').
  const foraDeCasa = resina;

  // A miniatura precisa do stream ligado (386). Uma vez por entrada em foco.
  const pedidoFeito = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!printer || !emFoco || !ligada || resina) return;
    if (pedidoFeito.current === printer.id) return;
    pedidoFeito.current = printer.id;
    try {
      sendCommand(printer.id, videoCommand(true, { id: printer.id }));
    } catch {
      // sem ligação: a miniatura fica sem imagem
    }
  }, [printer, emFoco, ligada, resina, sendCommand]);

  // Miniatura do ficheiro em curso, para ficar dentro do anel: dá contexto ao
  // progresso sem tirar espaço à percentagem (fica por baixo, com um véu escuro).
  const ficheiroEmCurso = info?.Filename;
  const [miniatura, setMiniatura] = React.useState<string | null>(null);
  const tentouEmbutida = React.useRef<string | null>(null);
  React.useEffect(() => {
    setMiniatura(null);
    tentouEmbutida.current = null;
    if (!printer || !ficheiroEmCurso) return;
    setMiniatura(urlMiniatura(enderecoDe(printer), ficheiroEmCurso));
  }, [printer, ficheiroEmCurso]);

  const semMiniaturaNoServidor = async () => {
    if (!printer || !ficheiroEmCurso) return;
    // Segunda falha (já era a PNG embutida): não insiste mais neste ficheiro.
    if (tentouEmbutida.current === ficheiroEmCurso) {
      setMiniatura(null);
      return;
    }
    tentouEmbutida.current = ficheiroEmCurso;
    // O servidor só tem /thumbnail para ficheiros que ele próprio fatiou; nos
    // outros vale a PNG que vem no cabeçalho do .gcode.
    const embutida = await extrairMiniaturaEmbutida(enderecoDe(printer), ficheiroEmCurso);
    setMiniatura(embutida);
  };

  const comandos = async (cmd: any) => {
    if (!printer) return;
    try {
      await request(printer.id, cmd, 8000);
    } catch (e) {
      Alert.alert(t('comum.erro'), e instanceof Error ? e.message : String(e));
    }
  };

  const pedirParar = () => {
    Alert.alert(t('comum.cancelarImpressao'), t('comum.interrompeImpressao'), [
      { text: t('comum.continuarImpressao'), style: 'cancel' },
      {
        text: t('comum.cancelarImpressao'),
        style: 'destructive',
        onPress: () => comandos(stopPrintCommand({ id: printer?.id })),
      },
    ]);
  };

  const temperaturas = resina
    ? []
    : [
        { rotulo: t('comum.bico'), valor: printer?.status?.TempOfNozzle ?? 0, alvo: printer?.status?.TempTargetNozzle ?? 0, cor: hexDe(paleta.aviso) },
        { rotulo: t('comum.mesa'), valor: printer?.status?.TempOfHotbed ?? 0, alvo: printer?.status?.TempTargetHotbed ?? 0, cor: hexDe(paleta.acento) },
        { rotulo: t('comum.camara'), valor: printer?.status?.TempOfBox ?? 0, alvo: printer?.status?.TempTargetBox ?? 0, cor: hexDe(paleta.ok) },
      ];

  if (!printer) {
    return (
      <View style={{ padding: espaco.lg }}>
        <Text style={{ color: hexDe(paleta.tintaSoft), fontSize: 13 }}>{t('filamentos.semMaquina')}</Text>
      </View>
    );
  }

  // Resina fora da rede local: a Saturn precisa do Wi-Fi de casa.
  if (foraDeCasa && !ligada && !printer.status) {
    return (
      <EstadoVazio
        pose="foraDeCasa"
        titulo={t('vazio.resinaSemResposta.titulo', { nome: printer.printerName })}
        descricao={t('vazio.resinaSemResposta.descricao')}
        acaoPrimaria={{ rotulo: t('vazio.tentarNovamente'), aoTocar: reconnectAll }}
        acaoSecundaria={{
          rotulo: t('vazio.editarIp'),
          aoTocar: () => navigation.navigate('EditarIp', { printerId: printer.id }),
        }}
      />
    );
  }

  // Primeira ligação desde que a app abriu: é espera, não é erro.
  if (printer.connectionStatus === 'connecting' && !jaLigouAntes.current) {
    return (
      <EstadoVazio
        pose="imprimindo"
        titulo={t('vazio.aLigar.titulo', { nome: printer.printerName })}
        descricao={t('vazio.aLigar.descricao')}
      />
    );
  }

  // Sem ligação e sem dados nenhuns: ainda não vale a pena mostrar números velhos.
  if (!ligada && !printer.status) {
    return (
      <EstadoVazio
        pose="semLigacao"
        titulo={t('vazio.semLigacao.titulo', { nome: printer.printerName })}
        descricao={t('vazio.semLigacao.descricao')}
        acaoPrimaria={{ rotulo: t('vazio.tentarNovamente'), aoTocar: reconnectAll }}
        acaoSecundaria={{
          rotulo: t('vazio.editarIp'),
          aoTocar: () => navigation.navigate('EditarIp', { printerId: printer.id }),
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.md, paddingBottom: 32 }}>
      {emFoco && ligada && !resina && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onAbrirCamara}
          style={{ borderRadius: raioToken.cartao, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: '#000' }}
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
          />
        </TouchableOpacity>
      )}

      {concluido && fimFechado !== chaveFim && (
        <View
          style={{
            backgroundColor: hexDe(paleta.cartao),
            borderRadius: raioToken.cartao,
            borderWidth: 1,
            borderColor: hexDe(paleta.linha),
            padding: espaco.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: espaco.sm,
          }}
        >
          <Mascote pose="concluido" tamanho={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta) }}>
              {t('vazio.concluido.titulo')}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 2 }}
            >
              {info?.Filename}
              {duracao ? ` · ${duracao}` : ''}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Stats')}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: hexDe(paleta.acento),
                  marginTop: 4,
                }}
              >
                {t('vazio.verHistorico')}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setFimFechado(chaveFim)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('comum.cancelar')}
          >
            <Ionicons name="close" size={18} color={hexDe(paleta.tintaSoft)} />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ backgroundColor: hexDe(paleta.cartao), borderRadius: raioToken.cartao, padding: espaco.lg, flexDirection: 'row', gap: espaco.lg, alignItems: 'center' }}>
        <Anel
          progresso={progresso}
          cor={hexDe(paleta.acento)}
          trilho={hexDe(paleta.linha)}
          imagem={
            miniatura ? (
              <Image
                source={{ uri: miniatura as string }}
                onError={semMiniaturaNoServidor}
                style={{
                  width: DIAMETRO_IMAGEM,
                  height: DIAMETRO_IMAGEM,
                  borderRadius: DIAMETRO_IMAGEM / 2,
                }}
                resizeMode="cover"
              />
            ) : undefined
          }
        >
          <Text style={{ fontSize: 28, fontWeight: '700', color: hexDe(paleta.tinta) }}>{Math.round(progresso)}%</Text>
          {segundosRestantes && (
            <Text style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 2 }}>{segundosRestantes}</Text>
          )}
        </Anel>

        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: hexDe(paleta.tinta) }}>
            {info?.Filename || printer.printerName}
          </Text>
          <Text style={{ fontSize: 12, color: estado.cor, marginTop: 6, fontWeight: '600' }}>{estado.texto}</Text>
          {!!info?.Filename && (
            <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft), marginTop: 4 }}>
              {`${t('detalhes.camada')} ${info.CurrentLayer ?? 0} / ${info.TotalLayer ?? 0}`}
            </Text>
          )}
        </View>
      </View>

      {temperaturas.length > 0 && (
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {temperaturas.map(item => (
            <View key={item.rotulo} style={{ flex: 1, backgroundColor: hexDe(paleta.cartao), borderRadius: raioToken.interno, padding: espaco.md }}>
              <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft) }}>{item.rotulo}</Text>
              <Text
                style={{
                  fontSize: 21,
                  fontWeight: '700',
                  fontFamily: fonteNumeros,
                  color: item.cor,
                  marginTop: 4,
                }}
              >
                {Math.round(item.valor)}°
              </Text>
              {item.alvo > 0 && (
                <Text style={{ fontSize: 11, fontFamily: fonteNumeros, color: hexDe(paleta.tintaSoft) }}>{`/ ${Math.round(item.alvo)}°`}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: espaco.sm }}>
        <TouchableOpacity
          onPress={() =>
            comandos(
              getPrintStatus(info?.Status ?? 0) === 'paused'
                ? resumePrintCommand({ id: printer.id })
                : pausePrintCommand({ id: printer.id })
            )
          }
          disabled={!info?.Filename}
          style={{
            flex: 1,
            height: 48,
            borderRadius: raioToken.botao,
            backgroundColor: hexDe(paleta.fundoBaixo),
            alignItems: 'center',
            justifyContent: 'center',
            opacity: info?.Filename ? 1 : 0.4,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: hexDe(paleta.tinta) }}>
            {getPrintStatus(info?.Status ?? 0) === 'paused' ? t('comum.retomar') : t('comum.pausar')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={pedirParar}
          disabled={!info?.Filename}
          style={{
            flex: 1,
            height: 48,
            borderRadius: raioToken.botao,
            borderWidth: 1.5,
            borderColor: hexDe(paleta.perigo),
            alignItems: 'center',
            justifyContent: 'center',
            opacity: info?.Filename ? 1 : 0.4,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: hexDe(paleta.perigo) }}>{t('comum.parar')}</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
};
