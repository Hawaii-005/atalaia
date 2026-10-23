import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Printer } from '../types';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import {
  pausePrintCommand,
  resumePrintCommand,
  stopPrintCommand,
} from '../utils/commands';
import { mensagemDoErro } from '../utils/errors';
import { formatTicksToReadableTime, formatTimeAgo } from '../utils/FormatUtils';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import {
  BT_ACENTO,
  BT_APAGADA,
  BT_PERIGO,
  TX_ACENTO,
  TX_NEUTRO,
  TX_PERIGO,
} from '../theme/botoes';

interface Props {
  printer: Printer;
  /** Abre o ecrã completo da resina (enviar ficheiro, imprimir). */
  onAbrir?: () => void;
}

/**
 * Trabalho de uma impressora de resina, em cartão: é o que substitui a câmara
 * nas máquinas que não têm vídeo. Só mostra o que o protocolo dela publica
 * (ficheiro, camada, tempos, estado) — nada de temperaturas nem pré-visualização.
 */
export const ResinJobCard: React.FC<Props> = ({ printer, onAbrir }) => {
  const { tema } = useTheme();
  const { request } = usePrinterConnections();

  const info = printer.status?.PrintInfo;
  const status = info?.Status ?? 0;
  const aImprimir = status === 6;
  const emPausa = status === 20;
  const parada = status === 8;
  const concluida = status === 9;
  const erro = Number(info?.ErrorNumber ?? 0);
  const progresso = Math.max(0, Math.min(100, info?.Progress ?? 0));
  const restante = Math.max(0, (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0));
  const decorrido = Math.max(0, info?.CurrentTicks ?? 0);
  const ligada = printer.connectionStatus === 'connected';
  const ficheiro = info?.Filename ? String(info.Filename).split('/').pop() : '';

  const controlar = async (acao: 'pausar' | 'retomar' | 'parar') => {
    try {
      const id = `resina-${Date.now()}`;
      if (acao === 'pausar') {
        await request(printer.id, pausePrintCommand({ id }));
      } else if (acao === 'retomar') {
        await request(printer.id, resumePrintCommand({ id }));
      } else {
        await request(printer.id, stopPrintCommand({ id }));
      }
    } catch (falha) {
      Alert.alert(t('resina.comandoRecusado'), mensagemDoErro(falha));
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

  const estado = !ligada
    ? t('resina.naoLigada')
    : concluida
    ? t('comum.impressaoConcluida')
    : parada
    ? t('comum.parada')
    : emPausa
    ? t('comum.emPausa')
    : aImprimir
    ? t('comum.aImprimir')
    : t('resina.emRepouso');

  const cor = !ligada
    ? tema.paleta.tintaMuted
    : erro
    ? tema.paleta.perigo
    : aImprimir
    ? tema.paleta.acento
    : emPausa
    ? tema.paleta.aviso ?? tema.paleta.tinta
    : tema.paleta.tintaMuted;

  return (
    <View className="rounded-xl2 border border-line bg-cartao p-4 mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[11px] text-ink-soft">
            {printer.printerName}
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: hexDe(cor) }}
            />
            <Text className="text-[15px] font-semibold text-ink">{estado}</Text>
          </View>
        </View>
        <View className="items-end">
          {/* Sem ligação não há dados: "—" em vez de um 0% que parece real. */}
          <Text className="text-[28px] font-bold text-ink leading-8">
            {ligada ? `${Math.round(progresso)}%` : '—'}
          </Text>
          <Text className="text-[10px] text-ink-soft" style={{ fontFamily: 'monospace' }}>
            {ligada ? `${info?.CurrentLayer ?? 0}/${info?.TotalLayer ?? 0}` : '—'}
          </Text>
        </View>
      </View>

      <View className="h-1.5 rounded-full bg-line mt-3 overflow-hidden">
        <View
          className="h-full bg-brand"
          style={{ width: `${Math.max(2, progresso)}%` }}
        />
      </View>

      <Text
        className="text-[12px] text-ink-muted mt-2"
        numberOfLines={1}
        style={{ fontFamily: 'monospace' }}
      >
        {ficheiro || t('resina.mesaLivre')}
      </Text>

      {/* Sem ligação, o que está no cartão é o último dado recebido — dizê-lo. */}
      {!ligada && printer.lastUpdate ? (
        <Text className="text-[11px] text-ink-soft mt-1">
          {t('monitor.ultimoDado', {
            t: formatTimeAgo(printer.lastUpdate, Date.now()),
          })}
        </Text>
      ) : null}

      {(aImprimir || emPausa) && (
        <View className="flex-row justify-between mt-1">
          <Text className="text-[11px] text-ink-soft" style={{ fontFamily: 'monospace' }}>
            {formatTicksToReadableTime(decorrido)}
          </Text>
          <Text className="text-[11px] text-ink-soft" style={{ fontFamily: 'monospace' }}>
            {t('comum.restantes', { t: formatTicksToReadableTime(restante) })}
          </Text>
        </View>
      )}

      {erro ? (
        <Text className={`text-[12px] mt-2 ${TX_PERIGO}`}>
          {t('resina.erroMaquina', { n: erro })}
        </Text>
      ) : null}

      <View className="flex-row mt-3">
        {aImprimir || emPausa ? (
          <TouchableOpacity
            className={`${BT_ACENTO} flex-1 py-2.5 mr-2`}
            onPress={() => controlar(emPausa ? 'retomar' : 'pausar')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={emPausa ? 'play' : 'pause'}
              size={13}
              color={hexDe(tema.paleta.acentoTexto)}
            />
            <Text className={`ml-2 text-[12px] ${TX_ACENTO}`}>
              {emPausa ? t('comum.retomar') : t('comum.pausar')}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className={`${BT_APAGADA} flex-1 py-2.5 mr-2`}>
            <Ionicons name="pause" size={13} color={hexDe(tema.paleta.tintaSoft)} />
            <Text className={`ml-2 text-[12px] ${TX_NEUTRO}`}>{t('comum.pausar')}</Text>
          </View>
        )}

        <TouchableOpacity
          className={`${BT_PERIGO} py-2.5 px-4 mr-2`}
          onPress={confirmarParar}
          disabled={!aImprimir && !emPausa}
          style={{ opacity: aImprimir || emPausa ? 1 : 0.45 }}
          activeOpacity={0.8}
        >
          <Ionicons name="stop" size={13} color={hexDe(tema.paleta.perigo)} />
          <Text className={`ml-2 text-[12px] ${TX_PERIGO}`}>{t('comum.parar')}</Text>
        </TouchableOpacity>

        {onAbrir ? (
          <TouchableOpacity className={`${BT_APAGADA} py-2.5 px-4`} onPress={onAbrir} activeOpacity={0.8}>
            <Ionicons name="open-outline" size={13} color={hexDe(tema.paleta.tinta)} />
            <Text className={`ml-2 text-[12px] ${TX_NEUTRO}`}>{t('monitor.abrir')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};
