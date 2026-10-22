import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import {
  DiscoveredPrinter,
  discoverPrinters,
  getLocalSubnet,
} from '../utils/PrinterDiscovery';

type ScanState = 'idle' | 'scanning' | 'done' | 'error';

export const DiscoveryScreen = ({ navigation }: any) => {
  const { printers, addPrinter, updatePrinterIp } = usePrinterConnections();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [found, setFound] = useState<DiscoveredPrinter[]>([]);
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(254);
  const [subnet, setSubnet] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runScan = useCallback(async () => {
    setScanState('scanning');
    setFound([]);
    setScanned(0);
    setErrorMessage('');

    try {
      const detectedSubnet = await getLocalSubnet();
      setSubnet(detectedSubnet);
      const results = await discoverPrinters((done, all) => {
        if (mountedRef.current) {
          setScanned(done);
          setTotal(all);
        }
      });
      if (!mountedRef.current) {
        return;
      }
      setFound(results);
      setScanState('done');
    } catch (error: any) {
      if (!mountedRef.current) {
        return;
      }
      setErrorMessage(error?.message || 'A análise da rede falhou.');
      setScanState('error');
    }
  }, []);

  useEffect(() => {
    runScan();
  }, [runScan]);

  const printerFor = (device: DiscoveredPrinter) => {
    const byIp = printers.find(p => p.ipAddress === device.ip);
    if (byIp) {
      return { printer: byIp, action: 'added' as const };
    }
    const byName = printers.find(
      p =>
        p.printerName.trim().toLowerCase() === device.name.trim().toLowerCase()
    );
    if (byName) {
      return { printer: byName, action: 'update' as const };
    }
    return { printer: undefined, action: 'add' as const };
  };

  const handleAdd = (device: DiscoveredPrinter) => {
    const { printer, action } = printerFor(device);
    if (action === 'added') return;
    if (action === 'update' && printer) {
      updatePrinterIp(printer.id, device.ip);
      Alert.alert(
        'Impressora actualizada',
        `${device.name} está agora em ${device.ip}. A restabelecer a ligação…`
      );
      return;
    }
    addPrinter(device.name, device.ip, device.mainboardId);
    Alert.alert(
      'Impressora adicionada',
      `${device.name} (${device.ip}) foi adicionada.`
    );
  };

  const scanning = scanState === 'scanning';
  const progress = total > 0 ? Math.min(scanned / total, 1) : 0;

  const statusLabel = scanning
    ? `A analisar ${subnet || 'a sua rede'}… ${scanned}/${total}`
    : scanState === 'error'
      ? errorMessage
      : `${found.length} impressora${found.length === 1 ? '' : 's'} encontrada${found.length === 1 ? '' : 's'}`;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title="Encontrar impressoras"
        subtitle={subnet ? `${subnet}.0/24` : 'Rede local'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-xl2 border border-line bg-white p-4">
          <View className="flex-row items-start">
            {scanning ? (
              <ActivityIndicator size="small" color="#3E6AE1" />
            ) : (
              <Ionicons
                name={
                  scanState === 'error'
                    ? 'alert-circle-outline'
                    : 'wifi'
                }
                size={16}
                color={scanState === 'error' ? '#C62828' : '#3E6AE1'}
              />
            )}
            <Text
              className={`ml-2 flex-1 text-[13px] leading-[19px] ${
                scanState === 'error' ? 'text-[#C62828]' : 'text-ink-soft'
              }`}
            >
              {statusLabel}
            </Text>
          </View>

          <View className="mt-3 h-[5px] rounded-full bg-[#DCDCDC] overflow-hidden">
            <View
              className="h-full rounded-full bg-brand"
              style={{
                width: `${
                  scanState === 'done' ? 100 : Math.max(3, progress * 100)
                }%`,
              }}
            />
          </View>

          <Text className="mt-3 text-[12px] leading-[18px] text-ink-muted">
            Encontra impressoras Elegoo na mesma rede Wi-Fi. Não precisa de
            escrever o IP.
          </Text>

          <TouchableOpacity
            className={`mt-4 rounded-xl2 py-3 items-center ${
              scanning ? 'bg-canvas-sunken' : 'bg-brand'
            }`}
            disabled={scanning}
            onPress={runScan}
            activeOpacity={0.85}
          >
            <Text
              className={`text-[14px] font-semibold ${
                scanning ? 'text-ink-muted' : 'text-white'
              }`}
            >
              {scanning ? 'A analisar…' : 'Analisar novamente'}
            </Text>
          </TouchableOpacity>
        </View>

        {found.map(device => {
          const { action } = printerFor(device);
          const label =
            action === 'added'
              ? 'ADICIONADA'
              : action === 'update'
                ? 'ATUALIZAR'
                : 'ADICIONAR';
          const disabled = action === 'added';

          return (
            <View
              key={device.ip}
              className="mt-3 rounded-xl2 border border-line bg-white p-4 flex-row items-center"
            >
              <View className="flex-1 pr-3">
                <Text className="text-[15px] font-semibold text-ink">
                  {device.name}
                </Text>
                <Text className="mt-1 text-[12px] text-ink-muted">
                  {device.ip}
                  {device.firmware ? ` · ${device.firmware}` : ''}
                </Text>
                {action === 'update' && (
                  <Text className="mt-1 text-[11px] text-[#8A6100]">
                    Impressora conhecida com um novo IP
                  </Text>
                )}
              </View>
              <TouchableOpacity
                className={`rounded-lg px-3.5 py-2 ${
                  disabled ? 'bg-canvas-sunken' : 'bg-brand'
                }`}
                disabled={disabled}
                onPress={() => handleAdd(device)}
                activeOpacity={0.8}
              >
                <Text
                  className={`text-[11px] font-bold tracking-wide ${
                    disabled ? 'text-ink-muted' : 'text-white'
                  }`}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {scanState === 'done' && found.length === 0 && (
          <View className="mt-4 rounded-xl2 bg-canvas-sunken p-4">
            <Text className="text-[13px] leading-[19px] text-ink-soft">
              Nada respondeu nesta rede. Verifique se a impressora está ligada e
              associada à mesma rede Wi-Fi que o telemóvel — e não ao seu
              próprio ponto de acesso de configuração.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddEditPrinter')}
              activeOpacity={0.7}
              className="mt-3"
            >
              <Text className="text-[13px] font-semibold text-brand">
                Adicionar manualmente
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
