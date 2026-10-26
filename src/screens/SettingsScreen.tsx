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
import { ORDEM_TEMAS, TEMAS, hexDe } from '../theme/temas';
import { BT_ACENTO, BT_NEUTRA, TX_ACENTO } from '../theme/botoes';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import {
  DEFAULT_PREFS,
  NotificationPrefs,
  loadNotificationPrefs,
  notify,
  prepareNotifications,
  saveNotificationPrefs,
} from '../utils/notifications';
import { t } from '../i18n';
import { getPrintStatus } from '../types';
import { useNavigation } from '@react-navigation/native';

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View className="rounded-2xl border border-line bg-cartao overflow-hidden">
    <Text className="px-4 pt-3 pb-1 text-[9px] tracking-[1.3px] font-bold text-ink-muted">
      {title}
    </Text>
    {children}
  </View>
);

const Row = ({
  icon,
  label,
  description,
  value,
  onPress,
  destructive,
  last,
  acento,
}: {
  icon: string;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
  acento?: string;
}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const content = (
    <View
      className={`flex-row items-center px-4 py-3.5 ${
        last ? '' : 'border-b border-line'
      }`}
    >
      <View
        className="w-8 h-8 rounded-[10px] items-center justify-center"
        style={{ backgroundColor: destructive ? hexDe(paleta.perigo) + '1F' : (acento ?? hexDe(paleta.acento)) + '1F' }}
      >
        <Ionicons
          name={icon as any}
          size={16}
          color={destructive ? hexDe(paleta.perigo) : (acento ?? hexDe(paleta.acento))}
        />
      </View>
      <View className="ml-3 flex-1 pr-2">
        <Text
          className={`text-[13px] font-semibold ${
            destructive ? 'text-state-danger' : 'text-ink'
          }`}
        >
          {label}
        </Text>
        {!!description && (
          <Text className="text-[10px] text-ink-muted mt-0.5" numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
      {!!value && (
        <Text className="text-[12px] font-semibold text-ink-soft mr-1">{value}</Text>
      )}
      {(onPress || !!value) && (
        <Ionicons name="chevron-forward" size={15} color={hexDe(paleta.tintaMuted)} />
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
}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  return (
  <View
    className={`flex-row items-center px-4 py-3 ${
      last ? '' : 'border-b border-line'
    }`}
  >
    <View
      className="w-8 h-8 rounded-[10px] items-center justify-center"
      style={{ backgroundColor: hexDe(paleta.acento) + '1F' }}
    >
      <Ionicons name={icon as any} size={16} color={hexDe(paleta.acento)} />
    </View>
    <View className="ml-3 flex-1 pr-2">
      <Text className="text-[13px] font-semibold text-ink">{label}</Text>
      <Text className="text-[10px] text-ink-muted mt-0.5">{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: hexDe(paleta.linha), true: hexDe(paleta.acento) }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={hexDe(paleta.linha)}
    />
  </View>
  );
};

const AcaoRow = ({
  icon,
  label,
  description,
  onPress,
}: {
  icon: string;
  label: string;
  description: string;
  onPress: () => void;
}) => {
  const { tema } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center px-4 py-3 border-b border-line"
      style={{ minHeight: 56 }}
    >
      <View
        className="w-8 h-8 rounded-[10px] items-center justify-center"
        style={{ backgroundColor: hexDe(tema.paleta.acento) + '1F' }}
      >
        <Ionicons name={icon as any} size={16} color={hexDe(tema.paleta.acento)} />
      </View>
      <View className="ml-3 flex-1 pr-2">
        <Text className="text-[13px] font-semibold text-ink">{label}</Text>
        <Text className="text-[10px] text-ink-muted mt-0.5">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={hexDe(tema.paleta.tintaMuted)} />
    </TouchableOpacity>
  );
};

/** 30000 → "30 s"; 60000 → "1 min" */
const formatarIntervalo = (ms: number) => {
  const segundos = Math.round(ms / 1000);
  return segundos < 60 ? `${segundos} s` : `${segundos / 60} min`;
};

/** 30 s e depois em minutos */
const INTERVALOS = [30000, 60000, 120000, 300000];

export const SettingsScreen = () => {
  const { tema, temaId, setTema } = useTheme();
  const navigation = useNavigation<any>();
  const {
    statusIntervalMs,
    setStatusInterval,
    filaAuto,
    fila,
    definirFilaAuto,
    printers,
    addPrinter,
  } = usePrinterConnections();
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPrefs>(DEFAULT_PREFS);

  const [modoRemoto, setModoRemoto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('modoRemoto')
      .then(valor => setModoRemoto(valor === '1'))
      .catch(() => undefined);
  }, []);

  const alternarModoRemoto = (ligado: boolean) => {
    setModoRemoto(ligado);
    AsyncStorage.setItem('modoRemoto', ligado ? '1' : '0').catch(() => undefined);
  };

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
      Alert.alert(t('comum.erro'), t('comum.erroLigacao'));
    }
  };

  const handleResetWelcomeFlow = () => {
    Alert.alert(
      t('settings.reiniciarBoasVindas'),
      t('settings.reiniciarBoasVindasMsg'),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('settings.reiniciar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('hasLaunched');
              Alert.alert(t('settings.concluido'), t('settings.boasVindasReiniciado'));
            } catch {
              Alert.alert(t('comum.erro'), t('settings.erroBoasVindas'));
            }
          },
        },
      ]
    );
  };

  const exportar = async () => {
    try {
      const dados = {
        versao: 1,
        criadoEm: new Date().toISOString(),
        impressoras: printers.map(p => ({
          printerName: p.printerName,
          ipAddress: p.ipAddress,
          alternateIp: p.alternateIp,
          mainboardId: p.mainboardId,
        })),
        preferencias: { statusIntervalMs, filaAuto },
      };
      const permissao =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissao.granted) return;
      const ficheiro = await FileSystem.StorageAccessFramework.createFileAsync(
        permissao.directoryUri,
        'cc-tool-backup',
        'application/json'
      );
      await FileSystem.writeAsStringAsync(ficheiro, JSON.stringify(dados, null, 2));
      Alert.alert(t('settings.backupTitulo'), t('settings.backupExportado'));
    } catch (erro) {
      Alert.alert(
        t('settings.backupTitulo'),
        erro instanceof Error ? erro.message : t('settings.backupFalhou')
      );
    }
  };

  const importar = async () => {
    try {
      const escolha = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (escolha.canceled) return;
      const texto = await FileSystem.readAsStringAsync(escolha.assets[0].uri);
      const dados = JSON.parse(texto);
      const lista = Array.isArray(dados?.impressoras) ? dados.impressoras : [];
      if (lista.length === 0) {
        Alert.alert(t('settings.backupTitulo'), t('settings.backupVazio'));
        return;
      }
      lista.forEach((p: any) => {
        if (p?.printerName && p?.ipAddress) {
          addPrinter(p.printerName, p.ipAddress, p.mainboardId, p.alternateIp);
        }
      });
      Alert.alert(
        t('settings.backupTitulo'),
        t('settings.backupImportado', { n: lista.length })
      );
    } catch {
      Alert.alert(t('settings.backupTitulo'), t('settings.backupFalhou'));
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('settings.title')}
        subtitle={
          printers.length > 0
            ? printers.map(pr => pr.printerName).slice(0, 3).join(' · ')
            : t('settings.subtitulo')
        }
      />

      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('settings.seccaoMaquinas')}>
          {printers.length === 0 ? (
            <Row
              icon="add-circle-outline"
              label={t('settings.adicionarImpressora')}
              description={t('camera.semImpressoras')}
              onPress={() => navigation.navigate('AddEditPrinter')}
              last
            />
          ) : (
            printers.map((pr, i) => {
              const info = pr.status?.PrintInfo;
              const aCorrer =
                getPrintStatus(info?.Status ?? 0) === 'printing' && !!info?.Filename;
              return (
                <Row
                  key={pr.id}
                  icon={pr.kind === 'resin' ? 'layers-outline' : 'print-outline'}
                  acento={pr.kind === 'resin' ? hexDe(tema.paleta.ok) : undefined}
                  label={pr.printerName}
                  description={`${pr.ipAddress} · ${
                    pr.connectionStatus === 'connected'
                      ? aCorrer
                        ? t('camera.aImprimir')
                        : t('camera.pronta')
                      : t('camera.impDesligada')
                  }`}
                  value={aCorrer ? `${Math.round(info?.Progress ?? 0)}%` : undefined}
                  onPress={() => navigation.navigate('AddEditPrinter', { printerId: pr.id })}
                  last={i === printers.length - 1}
                />
              );
            })
          )}
        </Section>

        <Section title={t('settings.seccaoAparencia')}>
          <View className="flex-row items-center px-4 py-3">
            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-ink">
                {TEMAS[temaId]?.nome ?? t('settings.tema')}
              </Text>
              <Text className="text-[10px] text-ink-muted mt-0.5">
                {t(`settings.tema_${temaId}`)}
              </Text>
            </View>
            <View className="flex-row" style={{ gap: 6 }}>
              {ORDEM_TEMAS.map(id => {
                const item = TEMAS[id];
                const activo = temaId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setTema(id)}
                    activeOpacity={0.8}
                    accessibilityLabel={item.nome}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      backgroundColor: item.amostra[0],
                      borderWidth: activo ? 2 : 1,
                      borderColor: activo ? '#FFFFFF' : hexDe(tema.paleta.linha),
                    }}
                  />
                );
              })}
            </View>
          </View>
          <Row
            icon="time-outline"
            label={t('settings.intervalo')}
            value={formatarIntervalo(statusIntervalMs)}
            last
          />
          <View className="flex-row px-4 pb-4" style={{ gap: 8 }}>
            {INTERVALOS.map(opcao => {
              const activo = statusIntervalMs === opcao;
              return (
                <TouchableOpacity
                  key={opcao}
                  onPress={() => setStatusInterval(opcao)}
                  activeOpacity={0.8}
                  className={`flex-1 rounded-full border py-2 items-center ${
                    activo ? BT_ACENTO : BT_NEUTRA
                  }`}
                >
                  <Text
                    className={`text-[12px] ${
                      activo ? TX_ACENTO : 'text-ink-soft font-medium'
                    }`}
                  >
                    {formatarIntervalo(opcao)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section title={t('settings.seccaoNotif')}>
          <SwitchRow
            icon="checkmark-circle-outline"
            label={t('settings.notifConcluida')}
            description={t('settings.notifConcluidaDesc')}
            value={notificationPrefs.finished}
            onChange={value => updateNotificationPref('finished', value)}
          />
          <SwitchRow
            icon="pause-circle-outline"
            label={t('settings.notifPausada')}
            description={t('settings.notifPausadaDesc')}
            value={notificationPrefs.paused}
            onChange={value => updateNotificationPref('paused', value)}
          />
          <SwitchRow
            icon="trending-up-outline"
            label={t('settings.notifMarcos')}
            description={t('settings.notifMarcosDesc')}
            value={notificationPrefs.milestones}
            onChange={value => updateNotificationPref('milestones', value)}
          />
          <SwitchRow
            icon="cloud-offline-outline"
            label={t('settings.notifDesligada')}
            description={t('settings.notifDesligadaDesc')}
            value={notificationPrefs.offline}
            onChange={value => updateNotificationPref('offline', value)}
          />
          <SwitchRow
            icon="cellular-outline"
            label={t('settings.modoRemoto')}
            description={t('settings.modoRemotoDesc')}
            value={modoRemoto}
            onChange={alternarModoRemoto}
          />
          <SwitchRow
            icon="list-outline"
            label={t('settings.filaAuto')}
            description={
              fila.length > 0
                ? t('settings.filaAutoDescN', { n: fila.length })
                : t('settings.filaAutoDesc')
            }
            value={filaAuto}
            onChange={definirFilaAuto}
          />

        </Section>

        <Section title={t('settings.seccaoBackup')}>
          <AcaoRow
            icon="share-outline"
            label={t('settings.exportar')}
            description={t('settings.exportarDesc')}
            onPress={exportar}
          />
          <AcaoRow
            icon="download-outline"
            label={t('settings.importar')}
            description={t('settings.importarDesc')}
            onPress={importar}
          />
          <Row
            icon="notifications-outline"
            label={t('settings.notificacaoTeste')}
            onPress={async () => {
              const granted = await prepareNotifications();
              if (!granted) {
                Alert.alert(
                  t('settings.notifBloqueadas'),
                  t('settings.notifBloqueadasMsg')
                );
                return;
              }
              await notify(
                t('settings.notifConcluida'),
                t('settings.notificacaoTesteCorpo')
              );
            }}
            last
          />
        </Section>

        <Section title={t('settings.seccaoSobre')}>
          <Row
            icon="information-circle-outline"
            label={t('settings.versaoApp')}
            value={Constants.expoConfig?.version || '—'}
          />
          <Row
            icon="logo-github"
            label="GitHub"
            onPress={() =>
              openUrl('https://github.com/Hawaii-005/atalaia')
            }
          />
          <Row
            icon="bug-outline"
            label={t('settings.comunicarProblema')}
            onPress={() =>
              openUrl('https://github.com/Hawaii-005/atalaia/issues')
            }
          />
          <Row icon="document-text-outline" label={t('settings.licenca')} value="MIT" last />
        </Section>

        <Section title={t('settings.seccaoManutencao')}>
          <Row
            icon="refresh-outline"
            label={t('settings.reiniciarBoasVindas')}
            onPress={handleResetWelcomeFlow}
            last
          />
        </Section>

        <Text className="mt-6 px-2 text-[11px] leading-[17px] text-ink-muted text-center">
          {t('settings.avisoComunidade')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
