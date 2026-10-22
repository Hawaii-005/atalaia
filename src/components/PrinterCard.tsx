import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Progress from 'react-native-progress';
import {
  Printer,
  ConnectionStatus,
  getPrintStatus,
  isPausable,
  isResumable,
  isStoppable,
} from '../types';
import {
  formatTimeAgo,
  formatTextMaxEllipsis,
  formatTicksToReadableTime,
} from '../utils/FormatUtils';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { BT_ACENTO, BT_APAGADA, BT_NEUTRA, BT_PERIGO, TX_ACENTO, TX_PERIGO } from '../theme/botoes';

interface PrinterCardProps {
  printer: Printer;
  onPress?: () => void;
  showTemps?: boolean;
  lastUpdate?: string;
  printStatus?: 'printing' | 'paused';
  onPrintControl?: () => void;
  onStopPrint?: () => void;
  showPrintControls?: boolean;
}

const STATUS_DOT: { [key in ConnectionStatus]: string } = {
  connected: '#1F9D55',
  connecting: '#F2A900',
  disconnected: '#9AA0A6',
  error: '#C62828',
  timeout: '#C62828',
};

// Etiquetas visíveis para o estado de ligação da impressora (chaves i18n).
const STATUS_LABEL: { [key in ConnectionStatus]: string } = {
  connected: 'comum.ligada',
  connecting: 'comum.aLigar',
  disconnected: 'comum.desligada',
  error: 'comum.erro',
  timeout: 'comum.tempoEsgotado',
};

export const PrinterCard = ({
  printer,
  onPress,
  showTemps = true,
  showPrintControls = false,
  onPrintControl,
  onStopPrint,
}: PrinterCardProps) => {
  const { tema } = useTheme();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = printer.status;
  const bedTemp = status?.TempOfHotbed || 0;
  const nozzleTemp = status?.TempOfNozzle || 0;
  const boxTemp = status?.TempOfBox || 0;
  const targetBedTemp = status?.TempTargetHotbed || 0;
  const targetNozzleTemp = status?.TempTargetNozzle || 0;
  const targetBoxTemp = status?.TempTargetBox || 0;
  const printInfo = status?.PrintInfo;
  const currentLayer = printInfo?.CurrentLayer || 0;
  const totalLayer = printInfo?.TotalLayer || 0;
  const progress = printInfo?.Progress || 0;
  const printStatusFromPrinter = printInfo?.Status || 0;
  const filename = printInfo?.Filename || '';
  const currentTicks = printInfo?.CurrentTicks || 0;
  const totalTicks = printInfo?.TotalTicks || 0;

  const readablePrintStatus = getPrintStatus(printStatusFromPrinter);
  const canPause = isPausable(printStatusFromPrinter);
  const canResume = isResumable(printStatusFromPrinter);
  const canStop = isStoppable(printStatusFromPrinter);
  const isPrinting = readablePrintStatus === 'printing';
  const isConnected = printer.connectionStatus === 'connected';

  // A reconectar tem prioridade: mostra quantas tentativas já falharam.
  const statusText = !isConnected && (printer.reconnectAttempt ?? 0) >= 2
    ? t('comum.aReconectarTentativa', { n: printer.reconnectAttempt ?? 0 })
    : readablePrintStatus === 'idle'
      ? t(STATUS_LABEL[printer.connectionStatus])
      : readablePrintStatus === 'completed'
        ? t('comum.impressaoConcluida')
        : readablePrintStatus === 'preparing'
          ? t('comum.aPreparar')
          : readablePrintStatus === 'paused'
            ? t('comum.emPausa')
            : readablePrintStatus === 'stopped'
              ? t('comum.parada')
              : t('comum.aImprimir');

  return (
    <TouchableOpacity
      className="rounded-xl2 border border-line bg-cartao p-4"
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Identity */}
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-[17px] font-semibold text-ink" numberOfLines={1}>
            {formatTextMaxEllipsis(printer.printerName, 22)}
          </Text>
          <Text className="text-xs text-ink-muted mt-1">
            {formatTextMaxEllipsis(printer.ipAddress, 30)}
            {printer.lastUpdate
              ? ` · ${formatTimeAgo(printer.lastUpdate, currentTime)}`
              : ''}
          </Text>
        </View>

        <View className="items-end">
          <View className="flex-row items-center">
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: STATUS_DOT[printer.connectionStatus],
              }}
            />
            <Text className="text-[11px] font-semibold text-ink-soft ml-1.5">
              {statusText}
            </Text>
          </View>
          {isConnected && onPress && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={hexDe(tema.paleta.tintaMuted)}
              style={{ marginTop: 6 }}
            />
          )}
        </View>
      </View>

      {/* Temperatures */}
      {isConnected && showTemps && (
        <View className="flex-row mt-4">
          {[
            { label: t('comum.bico'), value: nozzleTemp, target: targetNozzleTemp },
            { label: t('comum.mesa'), value: bedTemp, target: targetBedTemp },
            { label: t('comum.camara'), value: boxTemp, target: targetBoxTemp },
          ].map((tile, index) => (
            <View
              key={tile.label}
              className={`flex-1 ${index === 0 ? '' : 'pl-3 border-l border-line'}`}
            >
              <Text className="text-[10px] tracking-widest font-semibold text-ink-muted">
                {tile.label.toUpperCase()}
              </Text>
              <Text className="text-[17px] font-bold text-ink mt-0.5">
                {tile.value.toFixed(0)}
                <Text className="text-xs font-medium text-ink-muted">
                  ° / {tile.target.toFixed(0)}°
                </Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Print job */}
      {isConnected && readablePrintStatus !== 'idle' && (
        <View className="mt-4 pt-4 border-t border-line">
          <Text className="text-[13px] font-semibold text-ink" numberOfLines={1}>
            {isPrinting
              ? formatTextMaxEllipsis(filename, 34) || t('comum.aImprimir')
              : statusText}
          </Text>

          {totalLayer > 0 && (
            <View className="flex-row justify-between mt-1">
              <Text className="text-xs text-ink-muted">
                {t('comum.camada', { actual: currentLayer, total: totalLayer })}
              </Text>
              <Text className="text-xs text-ink-muted">
                {totalTicks > 0
                  ? t('comum.restantes', {
                      t: formatTicksToReadableTime(totalTicks - currentTicks),
                    })
                  : ''}
              </Text>
            </View>
          )}

          <View className="mt-3">
            <Progress.Bar
              progress={readablePrintStatus === 'completed' ? 1 : progress / 100}
              width={null}
              height={5}
              color={hexDe(tema.paleta.acento)}
              unfilledColor={hexDe(tema.paleta.linha)}
              borderWidth={0}
              borderRadius={3}
            />
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-xs font-semibold text-ink-soft">
              {readablePrintStatus === 'completed' ? 100 : progress}%
            </Text>

            {showPrintControls && (
              <View className="flex-row">
                {canStop && onStopPrint && (
                  <TouchableOpacity
                    onPress={onStopPrint}
                    className={`${BT_PERIGO} px-3 py-1.5 mr-2`}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="stop" size={12} color={hexDe(tema.paleta.perigo)} />
                    <Text className={`ml-1.5 text-[11px] ${TX_PERIGO}`}>{t('comum.parar')}</Text>
                  </TouchableOpacity>
                )}
                {(canPause || canResume) && onPrintControl && (
                  <TouchableOpacity
                    onPress={onPrintControl}
                    className={`${BT_ACENTO} px-3 py-1.5`}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={canResume ? 'play' : 'pause'}
                      size={11}
                      color={hexDe(tema.paleta.acento)}
                    />
                    <Text className={`ml-1.5 text-[11px] ${TX_ACENTO}`}>
                      {canResume ? t('comum.retomar') : t('comum.pausar')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};
