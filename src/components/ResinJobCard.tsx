import React, { useEffect, useState } from 'react';
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
import { miniaturaDe } from '../saturn/miniatura';
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
import { MiniPreview } from './MiniPreview';
import { estadoDaPrevia, limitarProgresso } from '../utils/revelacao';

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
  const progresso = limitarProgresso(info?.Progress);
  const restante = Math.max(0, (info?.TotalTicks ?? 0) - (info?.CurrentTicks ?? 0));
  const decorrido = Math.max(0, info?.CurrentTicks ?? 0);
  const ligada = printer.connectionStatus === 'connected';
  const ficheiro = info?.Filename
    ? String(info.Filename).split('/').pop() ?? ''
    : '';

  // Extensão do ficheiro para etiqueta
  const extensao = ficheiro
    ? ficheiro.split('.').pop()?.toUpperCase() ?? ''
    : '';

  // A miniatura vem do último envio deste ficheiro a partir da app.
  const [miniatura, setMiniatura] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    miniaturaDe(ficheiro).then((uri) => {
      if (vivo) setMiniatura(uri);
    });
    return () => {
      vivo = false;
    };
  }, [ficheiro]);

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

  // Estado textual e cor do ponto (igual a antes, mas usado na linha de topo)
  const estadoTexto = !ligada
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

  const corEstado = !ligada
    ? tema.paleta.tintaMuted
    : erro
    ? tema.paleta.perigo
    : aImprimir
    ? tema.paleta.acento
    : emPausa
    ? tema.paleta.aviso ?? tema.paleta.tinta
    : tema.paleta.tintaMuted;

  // Estado da pré-visualização (para o MiniPreview)
  const estadoPrevia = estadoDaPrevia(status, ligada);

  return (
    <View className="rounded-xl2 border border-line bg-cartao p-4 mb-3">
      {/* Linha de topo: nome da impressora à esquerda, estado à direita */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-[14.5px] font-semibold text-ink" style={{ letterSpacing: -0.008 * 14.5 }}>
          {printer.printerName}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <View
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: hexDe(corEstado) }}
          />
          <Text
            className="text-[11.5px] font-semibold"
            style={{ color: hexDe(corEstado), letterSpacing: -0.008 * 11.5 }}
          >
            {estadoTexto}
          </Text>
        </View>
      </View>

      {/* Miniatura ou caixa vazia */}
      {miniatura ? (
        <MiniPreview
          uri={miniatura}
          progresso={progresso}
          estado={estadoPrevia}
          altura={260}
        />
      ) : (
        <View
          className="rounded-lg mb-3 items-center justify-center border border-line"
          style={{ height: 200, backgroundColor: hexDe(tema.paleta.fundoBaixo) }}
        >
          <Ionicons name="layers-outline" size={22} color={hexDe(tema.paleta.tintaSoft)} />
          <Text className="text-[11px] text-ink-soft mt-1.5">
            {t('resina.semMiniatura')}
          </Text>
        </View>
      )}

      {/* Métricas: percentagem grande + camada X / Y */}
      <View className="flex-row items-end justify-between mb-2">
        <Text
          className="text-[40px] font-semibold text-ink"
          style={{ fontVariant: ['tabular-nums'], lineHeight: 40, letterSpacing: -0.035 * 40 }}
        >
          {ligada ? `${Math.round(progresso)}` : '—'}
          <Text className="text-[17px] font-semibold text-ink-muted" style={{ marginLeft: 1, fontVariant: ['tabular-nums'] }}>
            %
          </Text>
        </Text>
        <Text
          className="text-[11px] text-ink-muted"
          style={{ fontFamily: 'monospace', fontWeight: '500', letterSpacing: 0.02 * 11, paddingBottom: 5 }}
        >
          {ligada
            ? `${t('resina.camada', { x: info?.CurrentLayer ?? 0, y: info?.TotalLayer ?? 0 })}`
            : '—'}
        </Text>
      </View>

      {/* Barra de progresso: 3dp com miniatura, 6dp sem */}
      <View
        className="rounded-full bg-line overflow-hidden"
        style={{ height: miniatura ? 3 : 6, marginTop: 0 }}
      >
        <View
          className="h-full bg-brand"
          style={{ width: `${Math.max(2, progresso)}%` }}
        />
      </View>

      {/* Tempos: duas colunas */}
      <View className="flex-row justify-between mt-3">
        <View>
          <Text
            className="text-[9.5px] font-semibold text-ink-muted uppercase"
            style={{ letterSpacing: 0.9, lineHeight: 12 }}
          >
            {t('resina.decorrido')}
          </Text>
          <Text
            className="text-[12.5px] font-medium text-ink mt-1"
            style={{ fontFamily: 'monospace', fontVariant: ['tabular-nums'], lineHeight: 16 }}
          >
            {formatTicksToReadableTime(decorrido)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            className="text-[9.5px] font-semibold text-ink-muted uppercase"
            style={{ letterSpacing: 0.9, lineHeight: 12 }}
          >
            {t('resina.restante')}
          </Text>
          <Text
            className="text-[12.5px] font-medium text-ink mt-1"
            style={{ fontFamily: 'monospace', fontVariant: ['tabular-nums'], lineHeight: 16, textAlign: 'right' }}
          >
            {aImprimir || emPausa
              ? formatTicksToReadableTime(restante)
              : '—'}
          </Text>
        </View>
      </View>

      {/* Separador + linha do ficheiro */}
      <View className="h-0.5 bg-line mt-4" />
      <View className="flex-row items-center justify-between mt-3">
        <Text
          className="text-[11.5px] text-ink-muted flex-1"
          style={{ fontFamily: 'monospace', fontWeight: '500' }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {ficheiro || t('resina.mesaLivre')}
        </Text>
        {extensao && (
          <Text
            className="text-[9.5px] font-semibold text-ink-muted uppercase"
            style={{ fontFamily: 'monospace', fontWeight: '600', letterSpacing: 0.08 * 9.5 }}
          >
            {extensao}
          </Text>
        )}
      </View>

      {/* Sem ligação: aviso de último dado */}
      {!ligada && printer.lastUpdate ? (
        <Text className="text-[11px] text-ink-soft mt-2">
          {t('monitor.ultimoDado', {
            t: formatTimeAgo(printer.lastUpdate, Date.now()),
          })}
        </Text>
      ) : null}

      {/* Erro da máquina */}
      {erro ? (
        <Text className={`text-[12px] mt-2 ${TX_PERIGO}`}>
          {t('resina.erroMaquina', { n: erro })}
        </Text>
      ) : null}

      {/* Botões — iguais aos de hoje */}
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