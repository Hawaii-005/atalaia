import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  DEFAULT_PREFS,
  NotificationPrefs,
  loadNotificationPrefs,
  notify,
  prepareNotifications,
  saveNotificationPrefs,
} from '../utils/notifications';

type ThemeOption = 'light' | 'dark' | 'system';

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View className="mt-6">
    <Text className="mb-2 ml-1 text-[10px] tracking-widest font-semibold text-ink-soft">
      {title}
    </Text>
    <View className="rounded-xl2 border border-line bg-white overflow-hidden">
      {children}
    </View>
  </View>
);

const Row = ({
  icon,
  label,
  value,
  onPress,
  destructive,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}) => {
  const content = (
    <View
      className={`flex-row items-center px-4 py-3.5 ${
        last ? '' : 'border-b border-line'
      }`}
    >
      <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
        <Ionicons
          name={icon as any}
          size={16}
          color={destructive ? '#C62828' : '#3F444D'}
        />
      </View>
      <Text
        className={`ml-3 flex-1 text-[14px] font-medium ${
          destructive ? 'text-[#C62828]' : 'text-ink'
        }`}
      >
        {label}
      </Text>
      {!!value && (
        <Text className="text-[13px] text-ink-muted mr-1">{value}</Text>
      )}
      {onPress && !value && (
        <Ionicons name="chevron-forward" size={16} color="#9AA0A6" />
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
      {content}
    </TouchableOpacity>
  );
};

const SwitchRow = ({
  icon,
  label,
  description,
  value,
  onChange,
  last,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  last?: boolean;
}) => (
  <View
    className={`flex-row items-center px-4 py-3 ${
      last ? '' : 'border-b border-line'
    }`}
  >
    <View className="w-8 h-8 rounded-lg bg-canvas-sunken items-center justify-center">
      <Ionicons name={icon as any} size={16} color="#3F444D" />
    </View>
    <View className="ml-3 flex-1 pr-2">
      <Text className="text-[14px] font-medium text-ink">{label}</Text>
      <Text className="text-[11px] text-ink-muted mt-0.5">{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#E4E4E4', true: '#3E6AE1' }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E4E4E4"
    />
  </View>
);

export const SettingsScreen = () => {
  const { theme, setTheme } = useTheme();
  const { statusIntervalMs, setStatusInterval } = usePrinterConnections();
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadNotificationPrefs().then(setNotificationPrefs);
  }, []);

  const updateNotificationPref = async (
    key: keyof NotificationPrefs,
    value: boolean
  ) => {
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    await saveNotificationPrefs(next);
    if (value) {
      await prepareNotifications();
    }
  };

  const openUrl = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a ligação.');
    }
  };

  const handleResetWelcomeFlow = () => {
    Alert.alert(
      'Reiniciar fluxo de boas-vindas',
      'Os ecrãs de boas-vindas aparecem novamente da próxima vez que abrir a aplicação.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('hasLaunched');
              Alert.alert(
                'Concluído',
                'O fluxo de boas-vindas foi reiniciado.'
              );
            } catch {
              Alert.alert(
                'Erro',
                'Não foi possível reiniciar o fluxo de boas-vindas.'
              );
            }
          },
        },
      ]
    );
  };

  const options: { key: ThemeOption; label: string }[] = [
    { key: 'light', label: 'Claro' },
    { key: 'dark', label: 'Escuro' },
    { key: 'system', label: 'Sistema' },
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header title="Definições" subtitle="Preferências e sobre" />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="PREFERÊNCIAS">
          <View className="px-4 py-4">
            <Text className="text-[14px] font-medium text-ink">Tema</Text>
            <View className="mt-3 flex-row rounded-xl bg-canvas-sunken p-1">
              {options.map(option => {
                const active = theme === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setTheme(option.key)}
                    activeOpacity={0.7}
                    className={`flex-1 rounded-lg py-2 items-center ${
                      active ? 'bg-white border border-line' : ''
                    }`}
                  >
                    <Text
                      className={`text-[13px] ${
                        active
                          ? 'font-semibold text-ink'
                          : 'font-medium text-ink-soft'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Row
            icon="time-outline"
            label="Intervalo de actualização"
            value={`${Math.round(statusIntervalMs / 1000)}s`}
            onPress={() =>
              Alert.alert(
                'Intervalo de actualização',
                'Com que frequência pedir o estado à impressora',
                [
                  {
                    text: '5 segundos',
                    onPress: () => setStatusInterval(5000),
                  },
                  {
                    text: '15 segundos',
                    onPress: () => setStatusInterval(15000),
                  },
                  {
                    text: '30 segundos',
                    onPress: () => setStatusInterval(30000),
                  },
                  { text: 'Cancelar', style: 'cancel' },
                ]
              )
            }
            last
          />
        </Section>

        <Section title="NOTIFICAÇÕES">
          <SwitchRow
            icon="checkmark-circle-outline"
            label="Impressão concluída"
            description="Quando uma impressão termina"
            value={notificationPrefs.finished}
            onChange={value => updateNotificationPref('finished', value)}
          />
          <SwitchRow
            icon="pause-circle-outline"
            label="Em pausa ou interrompida"
            description="Quando uma impressão fica em pausa ou é cancelada"
            value={notificationPrefs.paused}
            onChange={value => updateNotificationPref('paused', value)}
          />
          <SwitchRow
            icon="trending-up-outline"
            label="Marcos de progresso"
            description="Aos 50% e aos 90%"
            value={notificationPrefs.milestones}
            onChange={value => updateNotificationPref('milestones', value)}
          />
          <SwitchRow
            icon="cloud-offline-outline"
            label="Impressora desligada"
            description="Se se desligar a meio de uma impressão"
            value={notificationPrefs.offline}
            onChange={value => updateNotificationPref('offline', value)}
          />
          <Row
            icon="notifications-outline"
            label="Enviar uma notificação de teste"
            onPress={async () => {
              const granted = await prepareNotifications();
              if (!granted) {
                Alert.alert(
                  'Notificações bloqueadas',
                  'Permita as notificações da CC Tool nas definições do Android.'
                );
                return;
              }
              await notify(
                'Impressão concluída',
                'A Centauri Carbon concluiu a sua impressão de teste.'
              );
            }}
            last
          />
        </Section>

        <Section title="SOBRE">
          <Row
            icon="information-circle-outline"
            label="Versão da aplicação"
            value={Constants.expoConfig?.version || '1.2.1'}
          />
          <Row
            icon="logo-github"
            label="GitHub"
            onPress={() =>
              openUrl('https://github.com/WalkerFrederick/CC-Tool')
            }
          />
          <Row
            icon="bug-outline"
            label="Comunicar um problema"
            onPress={() =>
              openUrl('https://github.com/WalkerFrederick/CC-Tool/issues')
            }
          />
          <Row icon="document-text-outline" label="Licença" value="MIT" last />
        </Section>

        <Section title="MANUTENÇÃO">
          <Row
            icon="refresh-outline"
            label="Reiniciar fluxo de boas-vindas"
            onPress={handleResetWelcomeFlow}
            last
          />
        </Section>

        <Text className="mt-6 px-2 text-[11px] leading-[17px] text-ink-muted text-center">
          A CC Tool é uma aplicação independente, criada pela comunidade, para
          impressoras Elegoo. Sem qualquer afiliação, apoio ou recomendação da
          Elegoo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
