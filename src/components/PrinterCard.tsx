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

const STATUS_LABEL: { [key in ConnectionStatus]: string } = {
  connected: 'Ligada',
  connecting: 'A ligar',
  disconnected: 'Desligada',
  error: 'Erro',
  timeout: 'Tempo esgotado',
};

export const PrinterCard = ({
  printer,
  onPress,
  showTemps = true,
  showPrintControls = false,
  onPrintControl,
  onStopPrint,
}: PrinterCardProps) => {
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
  const statusText = !isConnected && printer.reconnectAttempt
    ? `A reconectar (tentativa ${printer.reconnectAttempt})`
    : readablePrintStatus === 'idle'
      ? STATUS_LABEL[printer.connectionStatus]
      : readablePrintStatus === 'completed'
        ? 'Impressão concluída'
        : readablePrintStatus === 'preparing'
          ? 'A preparar'
          : readablePrintStatus === 'paused'
            ? 'Em pausa'
            : readablePrintStatus === 'stopped'
              ? 'Parada'
              : 'A imprimir';

  return (
    <TouchableOpacity
      className="rounded-xl2 border border-line bg-white p-4"
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
              color="#9AA0A6"
              style={{ marginTop: 6 }}
            />
          )}
        </View>
      </View>

      {/* Temperatures */}
      {isConnected && showTemps && (
        <View className="flex-row mt-4">
          {[
            { label: 'Bico', value: nozzleTemp, target: targetNozzleTemp },
            { label: 'Mesa', value: bedTemp, target: targetBedTemp },
            { label: 'Câmara', value: boxTemp, target: targetBoxTemp },
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
              ? formatTextMaxEllipsis(filename, 34) || 'A imprimir'
              : statusText}
          </Text>

          {totalLayer > 0 && (
            <View className="flex-row justify-between mt-1">
              <Text className="text-xs text-ink-muted">
                Camada {currentLayer}/{totalLayer}
              </Text>
              <Text className="text-xs text-ink-muted">
                {totalTicks > 0
                  ? `${formatTicksToReadableTime(totalTicks - currentTicks)} restantes`
                  : ''}
              </Text>
            </View>
          )}

          <View className="mt-3">
            <Progress.Bar
              progress={readablePrintStatus === 'completed' ? 1 : progress / 100}
              width={null}
              height={5}
              color="#3E6AE1"
              unfilledColor="#E4E4E4"
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
                    className="w-8 h-8 rounded-full bg-[#FCEDED] items-center justify-center mr-2"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="stop" size={15} color="#C62828" />
                  </TouchableOpacity>
                )}
                {(canPause || canResume) && onPrintControl && (
                  <TouchableOpacity
                    onPress={onPrintControl}
                    className="w-8 h-8 rounded-full bg-brand-soft items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={canResume ? 'play' : 'pause'}
                      size={15}
                      color="#3E6AE1"
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
