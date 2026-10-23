import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import {
  pausePrintCommand,
  resumePrintCommand,
  stopPrintCommand,
} from '../utils/commands';
import { mensagemDoErro } from '../utils/errors';
import { isPausable, isResumable, isStoppable } from '../types';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import {
  BT_ACENTO,
  BT_APAGADA,
  BT_NEUTRA,
  BT_PERIGO,
  TX_ACENTO,
  TX_PERIGO,
  TX_NEUTRO,
} from '../theme/botoes';

const formatoTamanho = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
};

const formatoTempo = (segundos: number) => {
  if (!segundos || segundos <= 0) return '—';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  return horas > 0 ? `${horas}h${String(minutos).padStart(2, '0')}` : `${minutos}m`;
};

/** Ecrã de uma impressora de resina (Saturn 3 Ultra). */
export const ResinScreen = ({ navigation, route }: any) => {
  const { printerId } = route.params ?? {};
  const { tema } = useTheme();
  const { printers, request, reconnectAll, carregarParaSaturno, imprimirNoSaturno } =
    usePrinterConnections();

  const printer = printers.find(p => p.id === printerId);
  const info = printer?.status?.PrintInfo;
  const status = info?.Status ?? 0;
  const aImprimir = status === 6;
  const emPausa = status === 20;
  // A máquina não recusa em silêncio: fica com o ficheiro e o erro no estado.
  const erroMaquina = Number(info?.ErrorNumber ?? 0);
  const progresso = Math.max(0, Math.min(100, info?.Progress ?? 0));
  const restante = Math.max(0, (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0));
  const ligada = printer?.connectionStatus === 'connected';

  const [ficheiro, setFicheiro] = useState<{
    uri: string;
    nome: string;
    tamanho: number;
  } | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [enviado, setEnviado] = useState(0);
  const [naImpressora, setNaImpressora] = useState<string | null>(null);

  if (!printer) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
        <Header title={t('resina.titulo')} onBack={() => navigation.goBack()} />
        <Text className="m-6 text-[13px] text-ink-muted">
          {t('resina.naoLigada')}
        </Text>
      </SafeAreaView>
    );
  }

  const escolherFicheiro = async () => {
    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (resultado.canceled || !resultado.assets?.length) return;
      const escolhido = resultado.assets[0];
      const nome = escolhido.name ?? 'ficheiro.goo';
      const extensao = nome.split('.').pop()?.toLowerCase() ?? '';
      if (extensao !== 'goo' && extensao !== 'ctb') {
        Alert.alert(t('resina.titulo'), t('resina.formatoInvalido'));
        return;
      }
      let tamanho = escolhido.size ?? 0;
      if (!tamanho) {
        const dados = await FileSystem.getInfoAsync(escolhido.uri, { size: true });
        tamanho = (dados as { size?: number }).size ?? 0;
      }
      setFicheiro({ uri: escolhido.uri, nome, tamanho });
      setEnviado(0);
      setNaImpressora(null);
    } catch (erro) {
      Alert.alert(t('resina.titulo'), mensagemDoErro(erro));
    }
  };

  const enviar = async () => {
    if (!ficheiro || aEnviar) return;
    setAEnviar(true);
    setEnviado(0);
    try {
      await carregarParaSaturno(printer.id, ficheiro.uri, ficheiro.nome, (feito, total) =>
        setEnviado(total ? feito / total : 0)
      );
      setNaImpressora(ficheiro.nome);
    } catch (erro) {
      Alert.alert(t('resina.falhouEnvio'), mensagemDoErro(erro));
    } finally {
      setAEnviar(false);
    }
  };

  const imprimir = () => {
    const nome = naImpressora;
    if (!nome) return;
    Alert.alert(
      t('resina.confirmarImprimir'),
      t('resina.confirmarImprimirMsg', { nome }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('resina.imprimir'),
          onPress: async () => {
            try {
              await imprimirNoSaturno(printer.id, nome);
            } catch (erro) {
              Alert.alert(t('resina.falhouImprimir'), mensagemDoErro(erro));
            }
          },
        },
      ]
    );
  };

  const controlar = async (acao: 'pausar' | 'retomar' | 'parar') => {
    try {
      if (acao === 'pausar') {
        await request(printer.id, pausePrintCommand({ id: `resina-${Date.now()}` }));
      } else if (acao === 'retomar') {
        await request(printer.id, resumePrintCommand({ id: `resina-${Date.now()}` }));
      } else {
        await request(printer.id, stopPrintCommand({ id: `resina-${Date.now()}` }));
      }
    } catch (erro) {
      Alert.alert(t('resina.comandoRecusado'), mensagemDoErro(erro));
    }
  };

  const confirmarParar = () =>
    Alert.alert(t('comum.cancelarImpressao'), t('resina.confirmarParar'), [
      { text: t('comum.continuarImpressao'), style: 'cancel' },
      {
        text: t('comum.pararImpressao'),
        style: 'destructive',
        onPress: () => controlar('parar'),
      },
    ]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={printer.printerName}
        subtitle={t('resina.subtitulo', { ip: printer.ipAddress })}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {!ligada && (
          <TouchableOpacity
            className="mb-3 rounded-xl2 border border-line bg-cartao p-4 flex-row items-center"
            onPress={() => reconnectAll()}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={hexDe(tema.paleta.aviso)} />
            <Text className="ml-2 flex-1 text-[13px] text-ink">
              {printer.reconnectAttempt
                ? t('comum.aReconectarTentativa', { n: printer.reconnectAttempt })
                : t('resina.naoLigada')}
            </Text>
            <Text className="text-[12px] font-semibold text-brand-texto">
              {t('resina.tentar')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Trabalho em curso, ou mesa livre */}
        <View className="mb-4">
          {aImprimir || emPausa ? (
            <>
              <View className="flex-row items-end justify-between">
                <Text
                  className="text-[54px] leading-[58px] font-bold text-ink"
                  style={{ fontFamily: 'monospace' }}
                >
                  {progresso}
                  <Text className="text-[18px] text-ink-muted"> %</Text>
                </Text>
                <View className="items-end pb-2 flex-1 pl-4">
                  <Text className="text-[12px] font-semibold text-ink" numberOfLines={1}>
                    {String(info?.Filename ?? '').split('/').pop()}
                  </Text>
                  <Text className="text-[11px] text-ink-muted mt-0.5">
                    {emPausa ? t('comum.emPausa') : t('comum.aImprimir')}
                  </Text>
                </View>
              </View>
              <View className="h-1.5 rounded-full bg-line mt-2 overflow-hidden">
                <View
                  className="h-full bg-brand"
                  style={{ width: `${Math.max(2, progresso)}%` }}
                />
              </View>
              <View className="flex-row items-center justify-between mt-2.5">
                <Text className="text-[11px] text-ink" style={{ fontFamily: 'monospace' }}>
                  {t('comum.camada', {
                    actual: info?.CurrentLayer ?? 0,
                    total: info?.TotalLayer ?? 0,
                  })}
                </Text>
                <Text className="text-[11px] text-ink-soft" style={{ fontFamily: 'monospace' }}>
                  {t('comum.restantes', { t: formatoTempo(restante) })}
                </Text>
              </View>
            </>
          ) : (
            <View className="rounded-xl2 border border-line bg-cartao p-4">
              <Text className="text-[10px] tracking-widest font-semibold text-ink-soft">
                {t('resina.estadoMaquina').toUpperCase()}
              </Text>
              <Text className="text-[22px] font-bold text-ink mt-1">
                {status === 9 ? t('comum.impressaoConcluida') : t('resina.emRepouso')}
              </Text>
              <Text className="text-[12px] text-ink-muted mt-1">
                {info?.Filename
                  ? String(info.Filename).split('/').pop()
                  : t('resina.mesaLivre')}
              </Text>
              {erroMaquina ? (
                <Text className={`text-[12px] mt-2 ${TX_PERIGO}`}>
                  {t('resina.erroMaquina', { n: erroMaquina })}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Controlos */}
        <View className="flex-row mb-6">
          {aImprimir || emPausa ? (
            <TouchableOpacity
              className={`${BT_ACENTO} flex-1 py-3 mr-2`}
              onPress={() => controlar(emPausa ? 'retomar' : 'pausar')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={emPausa ? 'play' : 'pause'}
                size={13}
                color={hexDe(tema.paleta.acento)}
              />
              <Text className={`ml-2 text-[12px] ${TX_ACENTO}`}>
                {emPausa ? t('comum.retomar') : t('comum.pausar')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View className={`${BT_APAGADA} flex-1 py-3 mr-2`}>
              <Ionicons name="pause" size={13} color={hexDe(tema.paleta.tintaMuted)} />
              <Text className={`ml-2 text-[12px] ${TX_NEUTRO}`}>{t('comum.pausar')}</Text>
            </View>
          )}

          <TouchableOpacity
            className={`${BT_PERIGO} flex-1 py-3`}
            onPress={confirmarParar}
            activeOpacity={0.8}
            disabled={!aImprimir && !emPausa}
            style={{ opacity: aImprimir || emPausa ? 1 : 0.45 }}
          >
            <Ionicons name="stop" size={13} color={hexDe(tema.paleta.perigo)} />
            <Text className={`ml-2 text-[12px] ${TX_PERIGO}`}>{t('comum.parar')}</Text>
          </TouchableOpacity>
        </View>

        {/* Enviar ficheiro */}
        <View className="rounded-xl2 border border-line bg-cartao p-4">
          <Text className="text-[10px] tracking-widest font-semibold text-ink-soft">
            {t('resina.enviarTitulo')}
          </Text>

          {ficheiro ? (
            <>
              <Text className="text-[14px] font-semibold text-ink mt-2" numberOfLines={1}>
                {ficheiro.nome}
              </Text>
              <Text className="text-[12px] text-ink-muted mt-0.5">
                {formatoTamanho(ficheiro.tamanho)}
                {naImpressora ? ` · ${t('resina.enviado')}` : ''}
              </Text>

              {aEnviar && (
                <View className="mt-3">
                  <View className="h-1.5 rounded-full bg-line overflow-hidden">
                    <View
                      className="h-full bg-brand"
                      style={{ width: `${Math.max(2, Math.round(enviado * 100))}%` }}
                    />
                  </View>
                  <Text className="text-[11px] text-ink-muted mt-1.5">
                    {t('resina.aEnviar', { pct: Math.round(enviado * 100) })}
                  </Text>
                </View>
              )}

              <View className="flex-row mt-3">
                <TouchableOpacity
                  className={`${BT_NEUTRA} px-3 py-2 mr-2`}
                  onPress={escolherFicheiro}
                  activeOpacity={0.8}
                  disabled={aEnviar}
                >
                  <Text className={`text-[11px] ${TX_NEUTRO}`}>
                    {t('resina.trocar')}
                  </Text>
                </TouchableOpacity>

                {naImpressora ? (
                  <TouchableOpacity
                    className={`${BT_ACENTO} flex-1 py-2`}
                    onPress={imprimir}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play" size={13} color={hexDe(tema.paleta.acento)} />
                    <Text className={`ml-2 text-[12px] ${TX_ACENTO}`}>
                      {t('resina.imprimir')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    className={`${BT_ACENTO} flex-1 py-2`}
                    onPress={enviar}
                    activeOpacity={0.85}
                    disabled={aEnviar}
                  >
                    {aEnviar ? (
                      <ActivityIndicator size="small" color={hexDe(tema.paleta.acento)} />
                    ) : (
                      <Ionicons name="cloud-upload-outline" size={13} color={hexDe(tema.paleta.acento)} />
                    )}
                    <Text className={`ml-2 text-[12px] ${TX_ACENTO}`}>
                      {aEnviar ? t('resina.aEnviarCurto') : t('resina.enviar')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              <Text className="text-[12px] text-ink-muted mt-1.5 leading-[18px]">
                {t('resina.enviarDica')}
              </Text>
              <TouchableOpacity
                className={`${BT_ACENTO} mt-3 py-3`}
                onPress={escolherFicheiro}
                activeOpacity={0.85}
              >
                <Ionicons name="folder-open-outline" size={15} color={hexDe(tema.paleta.acento)} />
                <Text className={`ml-2 text-[13px] ${TX_ACENTO}`}>
                  {t('resina.escolher')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text className="text-[11px] text-ink-muted mt-4 leading-[17px]">
          {t('resina.limites')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
