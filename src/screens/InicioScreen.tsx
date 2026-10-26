import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSelectedPrinter } from '../contexts/SelectedPrinterContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';
import { getPrintStatus, Printer } from '../types';
import { log } from '../utils/log';
import { loadHistory, formatDuration, PrintRecord } from '../utils/printHistory';
import { useJanela } from '../theme/layout';
import { fonteNumeros } from '../theme/tokensV6';
import { formatTicksToReadableTime } from '~/utils/FormatUtils';
import { Mascote } from '../ui/Mascote';
import { CartaoCamara } from '../components/CartaoCamara';
import { CartaoFila } from '../components/CartaoFila';

const TAMANHO_ANEL = 64;
const TRACO = 7;
const RAIO = (TAMANHO_ANEL - TRACO) / 2;
const PERIMETRO = 2 * Math.PI * RAIO;

const Anel: React.FC<{ progresso: number; cor: string; trilho: string; children?: React.ReactNode }> = ({
  progresso,
  cor,
  trilho,
  children,
}) => {
  const valor = Math.max(0, Math.min(100, progresso));
  return (
    <View style={{ width: TAMANHO_ANEL, height: TAMANHO_ANEL, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={TAMANHO_ANEL} height={TAMANHO_ANEL} style={{ position: 'absolute' }}>
        <Circle cx={TAMANHO_ANEL / 2} cy={TAMANHO_ANEL / 2} r={RAIO} stroke={trilho} strokeWidth={TRACO} fill="none" />
        <Circle
          cx={TAMANHO_ANEL / 2}
          cy={TAMANHO_ANEL / 2}
          r={RAIO}
          stroke={cor}
          strokeWidth={TRACO}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={PERIMETRO}
          strokeDashoffset={PERIMETRO * (1 - valor / 100)}
          transform={`rotate(-90 ${TAMANHO_ANEL / 2} ${TAMANHO_ANEL / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
};

const estadoTexto = (printer: Printer, semLigacao: string): { texto: string; cor: string } => {
  if (printer.connectionStatus !== 'connected') {
    return { texto: semLigacao, cor: 'perigo' };
  }
  const info = printer.status?.PrintInfo;
  if (!info?.Filename) {
    return {
      texto: printer.kind === 'resin' ? t('inicio.prontaResina') : t('inicio.pronta'),
      cor: 'ok',
    };
  }
  const estado = getPrintStatus(info.Status ?? 0);
  const mapa: Record<string, string> = {
    printing: t('estado.imprimindo'),
    paused: t('estado.emPausa'),
    preparing: t('estado.aPreparar'),
    completed: t('estado.terminada'),
    stopped: t('estado.parada'),
    idle: t('inicio.pronta'),
  };
  return { texto: mapa[estado] ?? t('inicio.pronta'), cor: estado === 'paused' ? 'aviso' : 'ok' };
};

export const InicioScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers } = usePrinterConnections();
  const { mudarMaquina, mudarSecao } = useSelectedPrinter();
  const { compacta, height, expandida } = useJanela();
  // Tablet (≥ 840 dp): duas colunas, como no conceito aprovado.
  const duasColunas = expandida;
  // Num ecrã alto (S25: 1085 dp) três registos deixavam ~310 dp vazios antes
  // da barra; mostrar mais preenche sem inventar conteúdo.
  const quantosHistorico = duasColunas ? 8 : height >= 1000 ? 6 : height >= 850 ? 5 : 3;
  // Em ecrãs altos sobra muito espaço em baixo: centrar o bloco de cartões
  // fica equilibrado, em vez de deixar ~380 dp de vazio antes da barra.
  // Só nos telemóveis altos: no tablet o conteúdo estica até ao fundo.
  const centrarConteudo = height >= 1000 && !duasColunas;
  const [historico, setHistorico] = useState<PrintRecord[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadHistory().then(r => setHistorico(r.slice(0, 8))).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick(v => v + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const fdm = useMemo(() => printers.find(p => (p.kind ?? 'fdm') !== 'resin'), [printers]);
  const temCamera = !!fdm && fdm.connectionStatus === 'connected';

  const cartao = {
    backgroundColor: hexDe(paleta.cartao),
    borderRadius: 20,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 }}>
          <Text style={{ flex: 1, fontSize: 26, fontWeight: '700', color: hexDe(paleta.tinta) }}>
            {t('inicio.titulo')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEditPrinter')}
            accessibilityLabel={t('home.adicionarImpressora')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: hexDe(paleta.cartao),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Ionicons name="add" size={22} color={hexDe(paleta.tinta)} />
          </TouchableOpacity>
          {!compacta && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel={t('settings.title')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: hexDe(paleta.cartao),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="settings-outline" size={20} color={hexDe(paleta.tinta)} />
          </TouchableOpacity>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 12, flex: 1, justifyContent: centrarConteudo ? 'center' : 'flex-start' }}>
          <View style={{ flexDirection: duasColunas ? 'row' : 'column', gap: 12, flex: duasColunas ? 1 : undefined }}>
          <View style={{ flex: duasColunas ? 1.1 : undefined, gap: 12 }}>
          {printers.map(printer => {
            const info = printer.status?.PrintInfo;
            const progresso = info?.Progress ?? 0;
            const estado = estadoTexto(printer, t('inicio.semLigacao'));
            const coresDoEstado: Record<string, string> = {
              ok: paleta.ok,
              aviso: paleta.aviso,
              perigo: paleta.perigo,
            };
            const corEstado = hexDe(coresDoEstado[estado.cor] ?? paleta.tintaSoft);
            const resina = printer.kind === 'resin';
            // Sem trabalho a correr a Saturn mantém o PrintInfo do último
            // trabalho (com Progress), por isso o anel e o nome do ficheiro
            // têm de sair do estado da máquina, não do que ficou para trás.
            const fase = getPrintStatus(printer.status?.PrintInfo?.Status ?? 0);
            const aCorrer = fase === 'printing' || fase === 'paused' || fase === 'preparing';
            // Só há «falta» quando o firmware diz quanto dura o trabalho; sem
            // TotalTicks (a Saturn) a linha fica como estava, sem inventar.
            const ticksPorFazer = (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0);
            const falta =
              aCorrer && ticksPorFazer > 0 ? formatTicksToReadableTime(ticksPorFazer) : '';
            return (
              <TouchableOpacity
                key={printer.id}
                onPress={() => {
                  mudarMaquina(printer.id);
                  navigation.navigate('Impressora');
                }}
                accessibilityRole="button"
                accessibilityLabel={`${printer.printerName}, ${estado.texto}`}
                style={[cartao, { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 }]}
              >
                <Anel progresso={aCorrer ? progresso : 0} cor={hexDe(paleta.acento)} trilho={hexDe(paleta.linha)}>
                  <Text
                    style={{
                      fontSize: 17,
                      lineHeight: 20,
                      fontWeight: '700',
                      fontFamily: fonteNumeros,
                      color: hexDe(paleta.tinta),
                    }}
                  >
                    {aCorrer ? `${Math.round(progresso)}%` : '—'}
                  </Text>
                </Anel>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 17, fontWeight: '700', color: hexDe(paleta.tinta) }}
                    >
                      {printer.printerName}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10,
                        backgroundColor: hexDe(paleta.linha),
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '600', color: hexDe(paleta.tintaSoft) }}>
                        {resina ? 'RESINA' : 'FDM'}
                      </Text>
                    </View>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 5 }}
                  >
                    {aCorrer ? info?.Filename || printer.ipAddress : printer.ipAddress}
                  </Text>
                  <Text style={{ fontSize: 12, marginTop: 4, fontWeight: '600' }}>
                    <Text style={{ color: corEstado }}>{estado.texto}</Text>
                    {falta ? (
                      <Text style={{ color: hexDe(paleta.tintaSoft), fontFamily: fonteNumeros }}>
                        {'  ·  '}
                        {t('inicio.falta', { t: falta })}
                      </Text>
                    ) : null}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => navigation.navigate('EditarIp', { printerId: printer.id })}
                  accessibilityRole="button"
                  accessibilityLabel={t('editarIp.titulo')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: hexDe(paleta.fundoBaixo),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="pencil" size={15} color={hexDe(paleta.tintaSoft)} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          {duasColunas && temCamera && fdm && (
            <CartaoCamara
              host={fdm.ipAddress}
              printerName={fdm.printerName}
              altura={200}
              esticar
              onAbrir={() => navigation.navigate('Camera', { printerId: fdm.id })}
            />
          )}

          {temCamera && fdm && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Camera', { printerId: fdm.id })}
                accessibilityRole="button"
                accessibilityLabel={`${t('inicio.camara')} · ${fdm.printerName}`}
                style={[cartao, { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 8 }]}
              >
                <Ionicons name="videocam-outline" size={22} color={hexDe(paleta.acentoTexto)} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(paleta.tinta) }}>
                  {t('inicio.camara')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  mudarMaquina(fdm.id);
                  mudarSecao('ficheiros');
                  navigation.navigate('Impressora');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('inicio.ficheiros')}
                style={[cartao, { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 8 }]}
              >
                <Ionicons name="folder-open-outline" size={22} color={hexDe(paleta.acentoTexto)} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(paleta.tinta) }}>
                  {t('inicio.ficheiros')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          </View>
          <View style={{ flex: duasColunas ? 1 : undefined, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: hexDe(paleta.tinta) }}>
              {t('inicio.historico')}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(paleta.acentoTexto) }}>
                {t('inicio.verTudo')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[cartao, { paddingVertical: 6, paddingHorizontal: 14 }, duasColunas ? { flex: 1 } : null]}>
            {historico.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Mascote pose="ocioso" tamanho={120} />
                <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft), paddingTop: 8 }}>
                  {t('inicio.semHistorico')}
                </Text>
              </View>
            )}
            {historico.slice(0, quantosHistorico).map((registo, indice) => {
              const falhou = registo.outcome === 'stopped';
              return (
                <View
                  key={registo.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    borderTopWidth: indice === 0 ? 0 : 1,
                    borderTopColor: hexDe(paleta.linha) + '66',
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: hexDe(paleta.fundoBaixo),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={falhou ? 'close' : 'checkmark'}
                      size={16}
                      color={falhou ? hexDe(paleta.perigo) : hexDe(paleta.ok)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 13, fontWeight: '600', color: hexDe(paleta.tinta) }}
                    >
                      {registo.filename}
                    </Text>
                    <Text style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 2 }}>
                      {registo.printerName}
                      {` · ${formatDuration(registo)}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <CartaoFila onAbrir={() => navigation.navigate('Fila')} />
          </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
