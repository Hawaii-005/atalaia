import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSelectedPrinter } from '../contexts/SelectedPrinterContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';
import { getPrintStatus, isResumable, Printer } from '../types';
import {
  loadHistory,
  formatDuration,
  PrintRecord,
} from '../utils/printHistory';
import { useJanela } from '../theme/layout';
import { fonteNumeros } from '../theme/tokensV6';
import { formatTicksToReadableTime } from '~/utils/FormatUtils';
import { CartaoFila } from '../components/CartaoFila';
import { urlMiniatura } from '../utils/miniatura';
import {
  pausePrintCommand,
  resumePrintCommand,
  stopPrintCommand,
} from '../utils/commands';
import {
  carregarInventario,
  custoPorGrama,
  garrafaActiva,
  Inventario,
  roloActivo,
} from '../utils/inventario';

const nomeCurto = (ficheiro?: string) => {
  if (!ficheiro) return '';
  return (
    ficheiro
      .split('/')
      .pop()
      ?.replace(/\.gcode$/i, '')
      .replace(/[_-]?Elegoo PLA.*$/i, '')
      .replace(/_[0-9.]+_[0-9]+m[0-9]*s$/i, '')
      .trim() ?? ''
  );
};

const euros = (valor: number) => `${valor.toFixed(2).replace('.', ',')} €`;

export const InicioScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers, request } = usePrinterConnections();
  const { mudarMaquina, mudarSecao } = useSelectedPrinter();
  const { height, expandida } = useJanela();
  const emFoco = useIsFocused();
  const duasColunas = expandida;

  const [historico, setHistorico] = useState<PrintRecord[]>([]);
  const [inventario, setInventario] = useState<Inventario>({
    rolos: [],
    garrafas: [],
    pendentes: [],
  });
  const [escolhidaId, setEscolhidaId] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadHistory()
      .then(r => setHistorico(r))
      .catch(() => {});
  }, []);

  // Ao voltar do inventário ou do histórico, os números têm de ser os de agora.
  useEffect(() => {
    if (!emFoco) return;
    carregarInventario()
      .then(setInventario)
      .catch(() => {});
    loadHistory()
      .then(setHistorico)
      .catch(() => {});
  }, [emFoco]);

  useEffect(() => {
    if (escolhidaId && printers.some(p => p.id === escolhidaId)) return;
    const ligada =
      printers.find(p => p.connectionStatus === 'connected') ?? printers[0];
    setEscolhidaId(ligada?.id);
  }, [printers, escolhidaId]);

  const escolhida = useMemo(
    () => printers.find(p => p.id === escolhidaId) ?? printers[0],
    [printers, escolhidaId]
  );
  const outras = printers.filter(p => p.id !== escolhida?.id);

  const cartao = {
    backgroundColor: hexDe(paleta.cartao),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hexDe(paleta.linha),
  } as const;

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

  if (!escolhida) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: hexDe(paleta.tintaSoft),
              textAlign: 'center',
            }}
          >
            {t('camera.semImpressoras')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEditPrinter')}
            style={{
              marginTop: 14,
              paddingHorizontal: 18,
              height: 42,
              borderRadius: 12,
              backgroundColor: hexDe(paleta.acento),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
              {t('home.adicionarImpressora')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const resina = (escolhida.kind ?? 'fdm') === 'resin';
  const info = escolhida.status?.PrintInfo;
  const fase = getPrintStatus(info?.Status ?? 0);
  const aCorrer =
    !!info?.Filename &&
    (fase === 'printing' || fase === 'paused' || fase === 'preparing');
  const progresso = aCorrer ? (info?.Progress ?? 0) : 0;
  const ticksPorFazer = (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0);
  const falta =
    aCorrer && ticksPorFazer > 0
      ? formatTicksToReadableTime(ticksPorFazer)
      : '';
  const ligadaEscolhida = escolhida.connectionStatus === 'connected';

  const ligada = fase === 'printing' || fase === 'preparing';
  const estadoTexto = !ligadaEscolhida
    ? t('inicio.semLigacao')
    : aCorrer
      ? ligada
        ? t('estado.imprimindo')
        : t('estado.emPausa')
      : resina
        ? t('inicio.prontaResina')
        : t('inicio.pronta');
  const corEstado = !ligadaEscolhida
    ? hexDe(paleta.perigo)
    : aCorrer
      ? hexDe(paleta.ok)
      : hexDe(paleta.tintaSoft);

  const rolo = roloActivo(inventario.rolos, escolhida.id);
  const garrafa = garrafaActiva(inventario.garrafas, escolhida.id);
  const imagem =
    info?.Filename && !resina
      ? urlMiniatura(escolhida.ipAddress, info.Filename)
      : null;

  const historicoDaMaquina = historico
    .filter(r => !r.printerName || r.printerName === escolhida.printerName)
    .slice(0, duasColunas ? 8 : height >= 1000 ? 5 : 4);

  const atalhos = [
    {
      icone: 'videocam-outline',
      etiqueta: t('inicio.camara'),
      aoTocar: () => navigation.navigate('Camera', { printerId: escolhida.id }),
      soFdm: true,
    },
    {
      icone: 'folder-open-outline',
      etiqueta: t('inicio.ficheiros'),
      aoTocar: () => {
        mudarMaquina(escolhida.id);
        mudarSecao('ficheiros');
        navigation.navigate('Impressora');
      },
    },
    {
      icone: 'stats-chart-outline',
      etiqueta: t('inicio.historico'),
      aoTocar: () => navigation.navigate('History'),
    },
    {
      icone: 'layers-outline',
      etiqueta: t('inv.titulo'),
      aoTocar: () => navigation.navigate('Inventario'),
    },
  ].filter(a => !(a.soFdm && resina));

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 26,
              fontWeight: '700',
              color: hexDe(paleta.tinta),
            }}
          >
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
            }}
          >
            <Ionicons name="add" size={22} color={hexDe(paleta.tinta)} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 14, gap: 12 }}>
          {printers.length > 1 && (
            <View
              style={{
                flexDirection: 'row',
                gap: 4,
                backgroundColor: hexDe(paleta.cartao),
                borderWidth: 1,
                borderColor: hexDe(paleta.linha),
                borderRadius: 13,
                padding: 4,
              }}
            >
              {printers.map(pr => {
                const activa = pr.id === escolhida.id;
                const prInfo = pr.status?.PrintInfo;
                const prFase = getPrintStatus(prInfo?.Status ?? 0);
                const cor =
                  pr.connectionStatus !== 'connected'
                    ? hexDe(paleta.perigo)
                    : prFase === 'printing' || prFase === 'preparing'
                      ? hexDe(paleta.ok)
                      : hexDe(paleta.tintaMuted);
                return (
                  <TouchableOpacity
                    key={pr.id}
                    onPress={() => setEscolhidaId(pr.id)}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 9,
                      borderRadius: 10,
                      backgroundColor: activa
                        ? hexDe(paleta.acento)
                        : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: activa ? '#0A0D18' : cor,
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: activa ? '#0A0D18' : hexDe(paleta.tintaSoft),
                      }}
                    >
                      {pr.printerName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* herói da máquina escolhida */}
          <View
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: hexDe(paleta.linha),
              backgroundColor: '#0A0F18',
            }}
          >
            <View style={{ aspectRatio: duasColunas ? 16 / 9 : 16 / 10 }}>
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                <View style={{ flex: 1, backgroundColor: '#0A0F18' }} />
              </View>
              {imagem && (
                <Image
                  source={{ uri: imagem }}
                  resizeMode="cover"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                  }}
                />
              )}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: imagem ? 'rgba(5,8,15,0.28)' : 'transparent',
                }}
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
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.14)',
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
                    backgroundColor: corEstado,
                  }}
                />
                <Text
                  style={{
                    fontSize: 9.5,
                    fontWeight: '800',
                    color: '#E7EDF9',
                    letterSpacing: 0.5,
                  }}
                >
                  {estadoTexto.toUpperCase()}
                </Text>
              </View>

              {!imagem && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={resina ? 'layers-outline' : 'print-outline'}
                    size={46}
                    color="#22304A"
                  />
                </View>
              )}

              <View
                style={{
                  position: 'absolute',
                  left: 14,
                  right: 14,
                  bottom: 12,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: hexDe(paleta.tinta),
                  }}
                >
                  {aCorrer
                    ? nomeCurto(info?.Filename) || escolhida.printerName
                    : escolhida.printerName}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: hexDe(paleta.tintaSoft),
                    marginTop: 2,
                  }}
                >
                  {aCorrer
                    ? `${t('comum.camada', { actual: info?.CurrentLayer ?? 0, total: info?.TotalLayer ?? 0 })}${falta ? ` · ${t('inicio.falta', { t: falta })}` : ''}`
                    : resina
                      ? t('inicio.prontaResina')
                      : `${escolhida.ipAddress} · ${t('inicio.pronta')}`}
                </Text>
                {aCorrer && (
                  <>
                    <View
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: hexDe(paleta.linha),
                        marginTop: 9,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.max(2, Math.min(100, progresso))}%`,
                          height: 5,
                          backgroundColor: hexDe(paleta.acento),
                        }}
                      />
                    </View>
                    <View
                      style={{ flexDirection: 'row', gap: 14, marginTop: 9 }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: hexDe(paleta.tinta),
                          fontFamily: fonteNumeros,
                        }}
                      >
                        {`${Math.round(progresso)}%`}
                      </Text>
                      {!resina && (
                        <>
                          <Text
                            style={{
                              fontSize: 11,
                              color: hexDe(paleta.tintaSoft),
                              fontFamily: fonteNumeros,
                            }}
                          >
                            {`${t('comum.bico')} ${Math.round(escolhida.status?.TempOfNozzle ?? 0)}°`}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: hexDe(paleta.tintaSoft),
                              fontFamily: fonteNumeros,
                            }}
                          >
                            {`${t('comum.mesa')} ${Math.round(escolhida.status?.TempOfHotbed ?? 0)}°`}
                          </Text>
                        </>
                      )}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {aCorrer && ligadaEscolhida && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() =>
                  acao(
                    escolhida,
                    isResumable(info?.Status ?? 0) ? 'retomar' : 'pausar'
                  )
                }
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: hexDe(paleta.fundoBaixo),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons
                  name={isResumable(info?.Status ?? 0) ? 'play' : 'pause'}
                  size={13}
                  color={hexDe(paleta.tinta)}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: hexDe(paleta.tinta),
                  }}
                >
                  {isResumable(info?.Status ?? 0)
                    ? t('comum.retomar')
                    : t('comum.pausar')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => acao(escolhida, 'parar')}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  borderWidth: 1.4,
                  borderColor: hexDe(paleta.perigo),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="stop" size={13} color={hexDe(paleta.perigo)} />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: hexDe(paleta.perigo),
                  }}
                >
                  {t('comum.parar')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* a outra máquina, numa linha */}
          {outras.map(pr => {
            const prInfo = pr.status?.PrintInfo;
            const prFase = getPrintStatus(prInfo?.Status ?? 0);
            const prCorre =
              !!prInfo?.Filename &&
              (prFase === 'printing' || prFase === 'preparing');
            return (
              <TouchableOpacity
                key={pr.id}
                onPress={() => setEscolhidaId(pr.id)}
                activeOpacity={0.85}
                style={{
                  ...cartao,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: hexDe(paleta.fundoBaixo),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={
                      (pr.kind ?? 'fdm') === 'resin'
                        ? 'layers-outline'
                        : 'print-outline'
                    }
                    size={15}
                    color={hexDe(paleta.tintaSoft)}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: hexDe(paleta.tinta),
                    }}
                  >
                    {pr.printerName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9.5,
                      color: hexDe(paleta.tintaSoft),
                      marginTop: 1,
                    }}
                  >
                    {pr.connectionStatus !== 'connected'
                      ? t('inicio.semLigacao')
                      : prCorre
                        ? `${t('estado.imprimindo')} · ${Math.round(prInfo?.Progress ?? 0)}%`
                        : t('inicio.pronta')}
                  </Text>
                </View>
                {prCorre && pr.connectionStatus === 'connected' && (
                  <>
                    <TouchableOpacity
                      onPress={() =>
                        acao(
                          pr,
                          isResumable(prInfo?.Status ?? 0)
                            ? 'retomar'
                            : 'pausar'
                        )
                      }
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        backgroundColor: hexDe(paleta.fundoBaixo),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={
                          isResumable(prInfo?.Status ?? 0) ? 'play' : 'pause'
                        }
                        size={13}
                        color={hexDe(paleta.tinta)}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => acao(pr, 'parar')}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: hexDe(paleta.perigo) + '88',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name="stop"
                        size={12}
                        color={hexDe(paleta.perigo)}
                      />
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            );
          })}

          {/* consumíveis */}
          {(rolo || garrafa) && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Inventario')}
              activeOpacity={0.85}
              style={{
                ...cartao,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 12,
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  backgroundColor:
                    rolo?.cor ?? garrafa?.cor ?? hexDe(paleta.linha),
                  borderWidth: 1,
                  borderColor: hexDe(paleta.linha),
                }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: hexDe(paleta.tinta),
                  }}
                >
                  {rolo ? rolo.nome : garrafa?.nome}
                </Text>
                <Text
                  style={{
                    fontSize: 9.5,
                    color: hexDe(paleta.tintaSoft),
                    marginTop: 1,
                  }}
                >
                  {rolo
                    ? `${rolo.material} · ${Math.round(rolo.restante)} g de ${rolo.pesoInicial} g · ${euros(custoPorGrama(rolo) * 1000)}/kg`
                    : `${Math.round(garrafa?.restante ?? 0)} ml de ${garrafa?.volumeInicial ?? 0} ml`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={hexDe(paleta.tintaMuted)}
              />
            </TouchableOpacity>
          )}

          {/* atalhos */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {atalhos.map(a => (
              <TouchableOpacity
                key={a.etiqueta}
                onPress={a.aoTocar}
                activeOpacity={0.85}
                style={{
                  ...cartao,
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  gap: 5,
                }}
              >
                <Ionicons
                  name={a.icone as any}
                  size={18}
                  color={hexDe(paleta.acentoTexto)}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 9.5,
                    fontWeight: '700',
                    color: hexDe(paleta.tintaSoft),
                  }}
                >
                  {a.etiqueta}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '700',
                color: hexDe(paleta.tinta),
              }}
            >
              {t('inicio.historico')}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: hexDe(paleta.acentoTexto),
                }}
              >
                {t('inicio.verTudo')}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{ ...cartao, paddingHorizontal: 13, paddingVertical: 4 }}
          >
            {historicoDaMaquina.length === 0 && (
              <Text
                style={{
                  fontSize: 11,
                  color: hexDe(paleta.tintaSoft),
                  paddingVertical: 12,
                  textAlign: 'center',
                }}
              >
                {t('inicio.semHistorico')}
              </Text>
            )}
            {historicoDaMaquina.map((registo, indice) => {
              const falhou = registo.outcome === 'stopped';
              return (
                <View
                  key={registo.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderTopWidth: indice === 0 ? 0 : 1,
                    borderTopColor: hexDe(paleta.linha) + '66',
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: hexDe(paleta.fundoBaixo),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={falhou ? 'close' : 'checkmark'}
                      size={14}
                      color={falhou ? hexDe(paleta.perigo) : hexDe(paleta.ok)}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: '600',
                      color: hexDe(paleta.tinta),
                    }}
                  >
                    {nomeCurto(registo.filename) || registo.filename}
                  </Text>
                  <Text
                    style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}
                  >
                    {formatDuration(registo)}
                  </Text>
                </View>
              );
            })}
          </View>

          <CartaoFila onAbrir={() => navigation.navigate('Fila')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
