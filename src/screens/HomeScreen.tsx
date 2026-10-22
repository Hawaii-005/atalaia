import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { PrinterCard } from '../components/PrinterCard';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { Ionicons } from '@expo/vector-icons';
import { checkLocalNetworkAccess } from '@generac/react-native-local-network-permission';

export const HomeScreen = ({ navigation }: any) => {
  const [refreshing, setRefreshing] = useState(false);
  const [hasNetworkAccess, setHasNetworkAccess] = useState(true);
  const { printers, reconnectAll, removePrinter, sendCommand } =
    usePrinterConnections();

  const checkNetworkAccess = async () => {
    const hasAccess = await checkLocalNetworkAccess();
    setHasNetworkAccess(hasAccess);
  };

  useEffect(() => {
    checkNetworkAccess();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reconnectAll();
    checkNetworkAccess();
    setTimeout(() => setRefreshing(false), 1000);
  }, [reconnectAll]);

  const handlePrinterPress = (printerId: string) => {
    const printer = printers.find(p => p.id === printerId);
    if (printer?.connectionStatus === 'connected') {
      navigation.navigate('PrinterDetails', { printerId });
      return;
    }
    // Enquanto a reconexão automática está a correr, não se sugere apagar a
    // impressora: dá-se a tentativa em curso e um botão para forçar já.
    if (printer?.reconnectAttempt) {
      Alert.alert(
        'A reconectar',
        `${printer.printerName}: tentativa ${printer.reconnectAttempt}. Já está a ser tentado automaticamente.`,
        [
          { text: 'Fechar', style: 'cancel' },
          { text: 'Tentar agora', onPress: () => reconnectAll() },
        ]
      );
      return;
    }
    Alert.alert(
      'Impressora desligada',
      `${printer?.printerName} não está ligada. Pode eliminá-la e adicioná-la de novo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar impressora',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Eliminar impressora',
              `Remover ${printer?.printerName}? Esta ação é irreversível.`,
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar',
                  style: 'destructive',
                  onPress: () => printer && removePrinter(printer.id),
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePrintControl = (printerId: string, status: number) => {
    const cmd = status === 6 ? 131 : 129;
    sendCommand(printerId, {
      Id: '',
      Data: {
        Cmd: cmd,
        Data: {},
        RequestID: `${cmd === 131 ? 'resume' : 'pause'}-${Date.now()}`,
        MainboardID: '',
        TimeStamp: Date.now(),
        From: 1,
      },
    });
  };

  const handleStopPrint = (printerId: string, name: string) => {
    Alert.alert('Cancelar impressão', `Parar a impressão em ${name}?`, [
      { text: 'Continuar a impressão', style: 'cancel' },
      {
        text: 'Parar impressão',
        style: 'destructive',
        onPress: () =>
          sendCommand(printerId, {
            Id: '',
            Data: {
              Cmd: 130,
              Data: {},
              RequestID: `cancel-${Date.now()}`,
              MainboardID: '',
              TimeStamp: Date.now(),
              From: 1,
            },
          }),
      },
    ]);
  };

  const onlineCount = printers.filter(
    p => p.connectionStatus === 'connected'
  ).length;

  const subtitle =
    printers.length === 0
      ? 'Ainda não há impressoras'
      : `${printers.length} impressora${printers.length === 1 ? '' : 's'} · ${onlineCount} ligada${onlineCount === 1 ? '' : 's'}`;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title="Impressoras"
        subtitle={subtitle}
        rightAction={{
          icon: 'wifi',
          onPress: () => navigation.navigate('Discovery'),
        }}
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3E6AE1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {printers.length > 0 && !hasNetworkAccess && (
          <TouchableOpacity
            className="mb-4 rounded-xl2 bg-[#FFF8E8] border border-[#F2E1B8] p-4 flex-row"
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="warning-outline" size={18} color="#8A6100" />
            <Text className="ml-2 flex-1 text-[13px] leading-[19px] text-[#6B4E00]">
              O acesso à rede local está desativado, pelo que não é possível
              comunicar com as impressoras. Abra as Definições para o permitir.
            </Text>
          </TouchableOpacity>
        )}

        {printers.length === 0 ? (
          <View className="flex-1 pt-10">
            <Image
              source={require('../../assets/CC.png')}
              className="w-24 h-24 self-center"
              resizeMode="contain"
            />
            <Text className="mt-6 text-[22px] font-bold text-ink text-center">
              Ainda não há impressoras
            </Text>
            <Text className="mt-2 text-[13px] leading-[20px] text-ink-muted text-center px-6">
              A sua impressora responde na mesma rede Wi-Fi. Analise a rede e
              ela será encontrada automaticamente.
            </Text>

            <TouchableOpacity
              className="mt-8 rounded-xl2 bg-brand py-4 items-center flex-row justify-center"
              onPress={() => navigation.navigate('Discovery')}
              activeOpacity={0.85}
            >
              <Ionicons name="wifi" size={18} color="#FFFFFF" />
              <Text className="ml-2 text-white font-semibold text-[15px]">
                Analisar rede
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 py-3 items-center"
              onPress={() => navigation.navigate('AddEditPrinter')}
              activeOpacity={0.7}
            >
              <Text className="text-ink-soft font-semibold text-[14px]">
                Adicionar manualmente
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {printers.map(printer => (
              <View key={printer.id} className="mb-3">
                <PrinterCard
                  printer={printer}
                  showPrintControls
                  onPrintControl={() =>
                    handlePrintControl(
                      printer.id,
                      printer.status?.PrintInfo?.Status || 0
                    )
                  }
                  onStopPrint={() =>
                    handleStopPrint(printer.id, printer.printerName)
                  }
                  onPress={() => handlePrinterPress(printer.id)}
                />
              </View>
            ))}

            <TouchableOpacity
              className="mt-2 rounded-xl2 border border-line py-3.5 items-center flex-row justify-center"
              onPress={() => navigation.navigate('AddEditPrinter')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#3F444D" />
              <Text className="ml-1.5 text-ink-soft font-semibold text-[14px]">
                Adicionar impressora
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 py-3 items-center flex-row justify-center"
              onPress={() => navigation.navigate('History')}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={16} color="#63676E" />
              <Text className="ml-1.5 text-ink-muted font-semibold text-[13px]">
                Histórico de impressões
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-2 items-center flex-row justify-center"
              onPress={() => navigation.navigate('Stats')}
              activeOpacity={0.7}
            >
              <Ionicons name="stats-chart-outline" size={16} color="#63676E" />
              <Text className="ml-1.5 text-ink-muted font-semibold text-[13px]">
                Estatísticas
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
