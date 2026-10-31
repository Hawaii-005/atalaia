import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { Header } from '../components/Header';
import { useGcodePreview } from '../hooks/useGcodePreview';
import {
  PrintRecord,
  clearHistory,
  formatDuration,
  loadHistory,
} from '../utils/printHistory';
import { t, localeActual, useIdioma } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { custoDe, euros, getPrecoKg } from '../utils/precos';
import {
  ackDaResposta,
  descreverAck,
  listFilesCommand,
  startPrintCommand,
} from '../utils/commands';
import { mensagemDeErro } from '../utils/errors';
import { hexDe } from '../theme/temas';
import { EstadoVazio } from '../ui/EstadoVazio';
import { lerTimelapse } from '../utils/timelapse';

// Etiquetas visíveis para o desfecho de cada impressão (chaves i18n).
const outcomeLabel: Record<PrintRecord['outcome'], string> = {
  printing: 'history.aImprimir',
  completed: 'history.concluida',
  stopped: 'history.parada',
  unknown: 'history.semConfirmacao',
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(localeActual(), {
    day: '2-digit',
    month: 'short',
  });
};

// «Hoje» / «Ontem» / data — os dias mais recentes não precisam de data.
const rotuloDoDia = (timestamp: number) => {
  const dia = new Date(timestamp);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const igual = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (igual(dia, hoje)) return t('history.hoje');
  if (igual(dia, ontem)) return t('history.ontem');
  return dia.toLocaleDateString(localeActual(), {
    day: '2-digit',
    month: 'long',
  });
};

const segundosDe = (record: PrintRecord) =>
  record.startedAt && record.endedAt
    ? Math.max(0, Math.round((record.endedAt - record.startedAt) / 1000))
    : 0;

const HistoryRow = ({
  record,
  onReprint,
}: {
  record: PrintRecord;
  onReprint: () => void;
}) => {
  useIdioma();
  // Um só pedido por linha: o mesmo texto dá a miniatura, as cores e as gramas.
  const { preview, filamentos, consumo } = useGcodePreview(
    record.printerIp,
    record.filename
  );
  const [precoKg, setPrecoKg] = useState(0);
  useEffect(() => {
    getPrecoKg()
      .then(setPrecoKg)
      .catch(() => undefined);
  }, []);
  const doCabecalho = filamentos.reduce((soma, f) => soma + f.gramas, 0);
  const gramas = doCabecalho > 0 ? doCabecalho : (consumo?.gramas ?? 0);
  const custo = gramas > 0 ? custoDe(gramas, precoKg) : 0;
  const { tema } = useTheme();
  const name = record.filename.split('/').pop() ?? record.filename;

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-line">
      <View className="w-14 h-14 rounded-lg bg-cartao border border-line items-center justify-center overflow-hidden">
        {preview ? (
          <Svg viewBox="0 0 100 100" width={52} height={52}>
            <Path
              d={preview.path}
              stroke={hexDe(tema.paleta.tinta)}
              strokeWidth={0.6}
              fill="none"
            />
          </Svg>
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
          {name}
        </Text>
        <Text className="text-[11px] text-ink-muted mt-1">
          {formatDate(record.startedAt)} · {formatDuration(record)} ·{' '}
          {t('comum.camadas', {
            n: record.layers ?? record.totalLayers ?? '—',
          })}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onReprint}
        className="h-11 w-11 items-center justify-center rounded-md border border-line mr-2"
        accessibilityRole="button"
        accessibilityLabel={t('history.reimprimirTitulo')}
        activeOpacity={0.7}
      >
        <Ionicons
          name="refresh"
          size={15}
          color={hexDe(tema.paleta.tintaSoft)}
        />
      </TouchableOpacity>
      <View
        className={`px-2 py-1 rounded-md ${
          record.outcome === 'completed'
            ? 'bg-state-ok/10'
            : record.outcome === 'stopped'
              ? 'bg-state-danger/10'
              : 'bg-brand-soft'
        }`}
      >
        <Text
          className={`text-[10px] font-semibold ${
            record.outcome === 'completed'
              ? 'text-state-ok'
              : record.outcome === 'stopped'
                ? 'text-state-danger'
                : 'text-brand-texto'
          }`}
        >
          {t(outcomeLabel[record.outcome])}
        </Text>
      </View>
    </View>
  );
};

export const HistoryScreen = ({ navigation }: any) => {
  useIdioma();
  const { tema } = useTheme();
  const { printers, request } = usePrinterConnections();
  const [records, setRecords] = useState<PrintRecord[]>([]);
  const [procura, setProcura] = useState('');
  const [ordem, setOrdem] = useState<'data' | 'duracao' | 'nome'>('data');

  const visiveis = useMemo(() => {
    const termo = procura.trim().toLowerCase();
    const lista = records.filter(
      r =>
        !termo ||
        (r.filename.split('/').pop() ?? r.filename)
          .toLowerCase()
          .includes(termo)
    );
    if (ordem === 'duracao')
      return [...lista].sort((a, b) => segundosDe(b) - segundosDe(a));
    if (ordem === 'nome')
      return [...lista].sort((a, b) => a.filename.localeCompare(b.filename));
    return [...lista].sort((a, b) => b.startedAt - a.startedAt);
  }, [records, procura, ordem]);

  // Agrupamento por dia só faz sentido na ordem cronológica.
  const grupos = useMemo(() => {
    if (ordem !== 'data') return null;
    const lista: { rotulo: string; itens: PrintRecord[] }[] = [];
    for (const r of visiveis) {
      const rotulo = rotuloDoDia(r.startedAt);
      const ultimo = lista[lista.length - 1];
      if (!ultimo || ultimo.rotulo !== rotulo)
        lista.push({ rotulo, itens: [r] });
      else ultimo.itens.push(r);
    }
    return lista;
  }, [visiveis, ordem]);

  // Reimprimir só com o ficheiro ainda na máquina: o histórico guarda o nome,
  // não o ficheiro. Se já não estiver lá, diz-se isso em vez de falhar em silêncio.
  const reimprimir = useCallback(
    async (record: PrintRecord) => {
      const base = record.filename.split('/').pop() ?? record.filename;
      const printer =
        printers.find(p => p.ipAddress === record.printerIp) ?? printers[0];
      if (!printer) {
        Alert.alert(t('history.reimprimirTitulo'), t('history.semImpressora'));
        return;
      }
      try {
        const dados = await request(
          printer.id,
          listFilesCommand('/local/', 1, 100)
        );
        const lista: { name: string }[] = dados?.FileList ?? [];
        const alvo = lista.find(f => f.name.endsWith(`/${base}`));
        if (!alvo) {
          Alert.alert(
            t('history.reimprimirTitulo'),
            t('history.ficheiroSumiu')
          );
          return;
        }
        const resposta = await request(
          printer.id,
          startPrintCommand(alvo.name, {
            nivelar: false,
            lado: 0,
            timelapse: (await lerTimelapse(printer.id)) ? 1 : 0,
          }),
          15000
        );
        const ack = ackDaResposta(resposta) ?? 0;
        if (ack !== 0) {
          Alert.alert(t('history.reimprimirTitulo'), descreverAck(ack));
          return;
        }
        Alert.alert(t('history.reimprimirTitulo'), t('history.aReimprimir'));
        navigation.navigate('Impressora');
      } catch (erro) {
        Alert.alert(t('history.reimprimirTitulo'), mensagemDeErro(erro));
      }
    },
    [printers, request, navigation]
  );

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setRecords);
    }, [])
  );

  const handleClear = () => {
    Alert.alert(t('history.limparTitulo'), t('history.limparMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('history.limpar'),
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setRecords([]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('history.title')}
        subtitle={
          records.length === 1
            ? t('history.contagem_um', { n: records.length })
            : t('history.contagem_outros', { n: records.length })
        }
        onBack={() => navigation.goBack()}
        rightAction={
          records.length > 0
            ? { icon: 'trash-outline', onPress: handleClear }
            : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {records.length === 0 ? (
          <View style={{ height: 400 }}>
            <EstadoVazio
              pose="ocioso"
              titulo={t('history.semImpressoes')}
              descricao={t('history.semImpressoesDica')}
            />
          </View>
        ) : (
          <>
            <View className="flex-row items-center rounded-lg border border-line bg-cartao px-2.5 h-10">
              <Ionicons
                name="search"
                size={15}
                color={hexDe(tema.paleta.tintaMuted)}
              />
              <TextInput
                value={procura}
                onChangeText={setProcura}
                placeholder={t('history.procurar')}
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

            <View className="flex-row items-center mt-2 mb-3">
              {(['data', 'duracao', 'nome'] as const).map(criterio => (
                <TouchableOpacity
                  key={criterio}
                  onPress={() => setOrdem(criterio)}
                  activeOpacity={0.7}
                  className={`px-3 h-8 items-center justify-center rounded-lg mr-1.5 border ${
                    ordem === criterio ? 'bg-brand border-brand' : 'border-line'
                  }`}
                >
                  <Text
                    className={`text-[12px] font-semibold ${
                      ordem === criterio ? 'text-white' : 'text-ink-soft'
                    }`}
                  >
                    {t(
                      criterio === 'data'
                        ? 'files.ordemData'
                        : criterio === 'duracao'
                          ? 'files.ordemDuracao'
                          : 'files.ordemNome'
                    )}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {visiveis.length === 0 ? (
              <View className="px-4 py-8 items-center">
                <Ionicons
                  name="search"
                  size={20}
                  color={hexDe(tema.paleta.tintaMuted)}
                />
                <Text className="text-[13px] text-ink-muted mt-2 text-center">
                  {t('history.semResultados', { q: procura.trim() })}
                </Text>
              </View>
            ) : grupos ? (
              grupos.map(grupo => (
                <View key={grupo.rotulo} className="mb-3">
                  <View className="flex-row items-center mb-1.5 px-1">
                    <Text className="text-[11px] font-semibold text-ink-soft">
                      {grupo.rotulo}
                    </Text>
                    <View className="flex-1 h-px bg-line mx-2" />
                    <Text className="text-[10px] text-ink-muted">
                      {grupo.itens.length}
                    </Text>
                  </View>
                  <View className="bg-canvas-sunken rounded-xl overflow-hidden">
                    {grupo.itens.map(record => (
                      <HistoryRow
                        key={record.id}
                        record={record}
                        onReprint={() => reimprimir(record)}
                      />
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View className="bg-canvas-sunken rounded-xl overflow-hidden">
                {visiveis.map(record => (
                  <HistoryRow
                    key={record.id}
                    record={record}
                    onReprint={() => reimprimir(record)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {records.length > 0 && (
          <Text className="text-[11px] text-ink-muted mt-3 px-1">
            {t('history.miniaturasDica')}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
