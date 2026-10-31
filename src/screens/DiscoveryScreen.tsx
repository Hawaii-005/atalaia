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
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

type ScanState = 'idle' | 'scanning' | 'done' | 'error';

export const DiscoveryScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
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
      setErrorMessage(error?.message || t('discovery.falhou'));
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
        t('discovery.atualizadaTitulo'),
        t('discovery.atualizadaMsg', { nome: device.name, ip: device.ip })
      );
      return;
    }
    addPrinter(device.name, device.ip, device.mainboardId, undefined, {
      kind: device.kind,
      sdcpId: device.sdcpId,
    });
    Alert.alert(
      t('discovery.adicionadaTitulo'),
      t('discovery.adicionadaMsg', { nome: device.name, ip: device.ip })
    );
  };

  const scanning = scanState === 'scanning';
  const progress = total > 0 ? Math.min(scanned / total, 1) : 0;

  const statusLabel = scanning
    ? t('discovery.aAnalisar', {
        rede: subnet || t('discovery.aSuaRede'),
        feitos: scanned,
        total,
      })
    : scanState === 'error'
      ? errorMessage
      : found.length === 1
        ? t('discovery.encontradas_um', { n: found.length })
        : t('discovery.encontradas_outros', { n: found.length });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('discovery.title')}
        subtitle={subnet ? `${subnet}.0/24` : t('discovery.redeLocal')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-xl2 border border-line bg-cartao p-4">
          <View className="flex-row items-start">
            {scanning ? (
              <ActivityIndicator
                size="small"
                color={hexDe(tema.paleta.acento)}
              />
            ) : (
              <Ionicons
                name={scanState === 'error' ? 'alert-circle-outline' : 'wifi'}
                size={16}
                color={
                  scanState === 'error'
                    ? hexDe(tema.paleta.perigo)
                    : hexDe(tema.paleta.acento)
                }
              />
            )}
            <Text
              className={`ml-2 flex-1 text-[13px] leading-[19px] ${
                scanState === 'error' ? 'text-state-danger' : 'text-ink-soft'
              }`}
            >
              {statusLabel}
            </Text>
          </View>

          <View className="mt-3 h-[5px] rounded-full bg-line overflow-hidden">
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
            {t('discovery.dica')}
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
              {scanning
                ? t('discovery.aAnalisarBotao')
                : t('discovery.analisarDeNovo')}
            </Text>
          </TouchableOpacity>
        </View>

        {found.map(device => {
          const { action } = printerFor(device);
          const label =
            action === 'added'
              ? t('discovery.adicionada')
              : action === 'update'
                ? t('discovery.atualizar')
                : t('discovery.adicionar');
          const disabled = action === 'added';

          return (
            <View
              key={device.ip}
              className="mt-3 rounded-xl2 border border-line bg-cartao p-4 flex-row items-center"
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
                  <Text className="mt-1 text-[11px] text-state-light">
                    {t('discovery.conhecidaNovoIp')}
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
              {t('discovery.semRespostas')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddEditPrinter')}
              activeOpacity={0.7}
              className="mt-3"
            >
              <Text className="text-[13px] font-semibold text-brand-texto">
                {t('discovery.adicionarManualmente')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={() => navigation.navigate('Abas')}
          accessibilityRole="button"
          activeOpacity={0.8}
          style={{
            marginTop: 24,
            marginBottom: 8,
            borderWidth: 1.5,
            borderColor: hexDe(tema.paleta.linha),
            backgroundColor: hexDe(tema.paleta.fundoBaixo),
            borderRadius: 14,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: hexDe(tema.paleta.tinta),
            }}
          >
            {t('discovery.voltarInicio')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
