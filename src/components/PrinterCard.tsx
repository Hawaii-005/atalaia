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
import { t, useIdioma } from '../i18n';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import {
  BT_ACENTO,
  BT_APAGADA,
  BT_NEUTRA,
  BT_PERIGO,
  TX_ACENTO,
  TX_PERIGO,
} from '../theme/botoes';

interface PrinterCardProps {
  printer: Printer;
  onPress?: () => void;
  showTemps?: boolean;
  lastUpdate?: string;
  printStatus?: 'printing' | 'paused';
  onPrintControl?: () => void;
  onStopPrint?: () => void;
  showPrintControls?: boolean;
  onToggleLight?: () => void;
  onOpenCamera?: () => void;
}

const MEDALHA = 58;

// Cores do ponto de estado, tiradas do tema (nunca hex à mão).
const corDoEstado = (
  estado: ConnectionStatus,
  paleta: { ok: string; aviso: string; tintaMuted: string; perigo: string }
): string => {
  switch (estado) {
    case 'connected':
      return paleta.ok;
    case 'connecting':
      return paleta.aviso;
    case 'error':
    case 'timeout':
      return paleta.perigo;
    default:
      return paleta.tintaMuted;
  }
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
  onToggleLight,
  onOpenCamera,
}: PrinterCardProps) => {
  useIdioma();
  const { tema } = useTheme();
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = printer.status;
  const luzLigada = !!printer.status?.LightStatus?.SecondLight;
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
  const statusText =
    !isConnected && (printer.reconnectAttempt ?? 0) >= 2
      ? t('comum.aReconectarTentativa', { n: printer.reconnectAttempt ?? 0 })
      : readablePrintStatus === 'idle'
        ? t(STATUS_LABEL[printer.connectionStatus])
        : readablePrintStatus === 'completed'
          ? t('comum.impressaoConcluida')
          : readablePrintStatus === 'preparing'
            ? // O código 20 é pausa (a máquina mantém-se pronta a retomar).
              canResume
              ? t('comum.emPausa')
              : t('comum.aPreparar')
            : readablePrintStatus === 'paused'
              ? t('comum.emPausa')
              : readablePrintStatus === 'stopped'
                ? t('comum.parada')
                : t('comum.aImprimir');

  const percentual =
    readablePrintStatus === 'completed'
      ? 100
      : Math.max(0, Math.min(100, progress));

  return (
    <TouchableOpacity
      className="rounded-xl2 border border-line bg-cartao p-4"
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Identity */}
      <View className="flex-row items-center">
        <View style={{ width: MEDALHA, height: MEDALHA }} className="mr-3">
          <Svg width={MEDALHA} height={MEDALHA}>
            <Circle
              cx={MEDALHA / 2}
              cy={MEDALHA / 2}
              r={MEDALHA / 2 - 3}
              stroke={hexDe(tema.paleta.linha)}
              strokeWidth={3}
              fill="none"
            />
            <Circle
              cx={MEDALHA / 2}
              cy={MEDALHA / 2}
              r={MEDALHA / 2 - 3}
              stroke={corDoEstado(printer.connectionStatus, tema.paleta)}
              strokeWidth={3}
              fill="none"
              strokeDasharray={`${2 * Math.PI * (MEDALHA / 2 - 3)} ${2 * Math.PI * (MEDALHA / 2 - 3)}`}
              strokeDashoffset={
                2 *
                Math.PI *
                (MEDALHA / 2 - 3) *
                (1 - Math.min(100, Math.max(0, percentual)) / 100)
              }
              strokeLinecap="round"
              transform={`rotate(-90 ${MEDALHA / 2} ${MEDALHA / 2})`}
              opacity={
                isPrinting || readablePrintStatus === 'completed' ? 1 : 0.35
              }
            />
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            {isPrinting || readablePrintStatus === 'completed' ? (
              <Text className="text-[13px] font-bold text-ink">
                {readablePrintStatus === 'completed' ? 100 : progress}%
              </Text>
            ) : (
              <Ionicons
                name="print-outline"
                size={17}
                color={hexDe(tema.paleta.tintaMuted)}
              />
            )}
          </View>
        </View>

        <View className="flex-1 pr-3">
          <Text
            className="text-[17px] font-semibold text-ink"
            numberOfLines={1}
          >
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
                backgroundColor: corDoEstado(
                  printer.connectionStatus,
                  tema.paleta
                ),
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
            {
              label: t('comum.bico'),
              value: nozzleTemp,
              target: targetNozzleTemp,
            },
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
          <Text
            className="text-[13px] font-semibold text-ink"
            numberOfLines={1}
          >
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

          <View className="flex-row items-center justify-between mt-3">
            {showPrintControls && (
              <View className="flex-row">
                {canStop && onStopPrint && (
                  <TouchableOpacity
                    onPress={onStopPrint}
                    className={`${BT_PERIGO} px-3 py-1.5 mr-2`}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="stop"
                      size={12}
                      color={hexDe(tema.paleta.perigo)}
                    />
                    <Text className={`ml-1.5 text-[11px] ${TX_PERIGO}`}>
                      {t('comum.parar')}
                    </Text>
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

            {(onToggleLight || onOpenCamera) && (
              <View className="flex-row">
                {onToggleLight && (
                  <TouchableOpacity
                    onPress={onToggleLight}
                    accessibilityRole="button"
                    accessibilityLabel={
                      luzLigada ? 'Desligar luz' : 'Ligar luz'
                    }
                    className={`${luzLigada ? BT_ACENTO : BT_NEUTRA} px-2.5 py-1.5 mr-2`}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={luzLigada ? 'bulb' : 'bulb-outline'}
                      size={13}
                      color={hexDe(
                        luzLigada ? tema.paleta.acento : tema.paleta.tintaSoft
                      )}
                    />
                  </TouchableOpacity>
                )}
                {onOpenCamera && (
                  <TouchableOpacity
                    onPress={onOpenCamera}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifications.viewCamera')}
                    className={`${BT_NEUTRA} px-2.5 py-1.5`}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={13}
                      color={hexDe(tema.paleta.tintaSoft)}
                    />
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
