import { log } from './log';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

/** Categorias dos avisos com botões, para parar/pausar sem abrir a app. */
export const CATEGORIA_EM_CURSO = 'impressao-em-curso';
export const CATEGORIA_EM_PAUSA = 'impressao-em-pausa';
export const CATEGORIA_FILA_ARRANQUE = 'fila-arranque-mesa-limpa';

export type CategoriaAviso =
  | 'em-curso'
  | 'em-pausa'
  | 'fila-arranque'
  | undefined;

const CHANNEL_ID = 'print-status';
const PREFS_KEY = 'notificationPrefs';

export interface NotificationPrefs {
  finished: boolean;
  paused: boolean;
  milestones: boolean;
  offline: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  finished: true,
  paused: true,
  milestones: false,
  offline: true,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Creates the Android channel and asks for permission once. Safe to call twice. */
export const prepareNotifications = async () => {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Print status',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: '#3E6AE1',
        sound: 'default',
      });
    }

    // Botões nos avisos: agir sem abrir a app.
    await Notifications.setNotificationCategoryAsync(CATEGORIA_EM_CURSO, [
      {
        identifier: 'PAUSAR',
        buttonTitle: 'Pausar',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'PARAR',
        buttonTitle: 'Parar',
        options: { opensAppToForeground: false, isDestructive: true },
      },
      {
        identifier: 'VER',
        buttonTitle: 'Ver câmara',
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORIA_EM_PAUSA, [
      {
        identifier: 'RETOMAR',
        buttonTitle: 'Retomar',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'PARAR',
        buttonTitle: 'Parar',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORIA_FILA_ARRANQUE, [
      {
        identifier: 'ARRANCAR_AGORA',
        buttonTitle: 'Mesa limpa: Arrancar agora',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'CANCELAR_ARRANQUE',
        buttonTitle: 'Cancelar',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    if (!current.canAskAgain) {
      return false;
    }
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch (error) {
    log('notifications setup failed', error);
    return false;
  }
};

export const loadNotificationPrefs = async (): Promise<NotificationPrefs> => {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
};

export const saveNotificationPrefs = async (prefs: NotificationPrefs) => {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    log('could not save notification prefs', error);
  }
};

/** Vai buscar um fotograma à câmara, para anexar ao aviso (iOS). */
const obterFotograma = async (ip?: string): Promise<string | null> => {
  if (!ip) return null;
  try {
    const destino = `${FileSystem.cacheDirectory}fotograma_${Date.now()}.jpg`;
    const resposta = await FileSystem.downloadAsync(
      `http://${ip}:3031/snapshot`,
      destino
    );
    return resposta.status === 200 ? resposta.uri : null;
  } catch (error) {
    log('snapshot for notification failed', error);
    return null;
  }
};

export const notify = async (
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  categoria?: CategoriaAviso,
  ipDaImpressora?: string
) => {
  try {
    const fotograma =
      categoria && Platform.OS === 'ios'
        ? await obterFotograma(ipDaImpressora)
        : null;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        categoryIdentifier:
          categoria === 'em-curso'
            ? CATEGORIA_EM_CURSO
            : categoria === 'em-pausa'
              ? CATEGORIA_EM_PAUSA
              : categoria === 'fila-arranque'
                ? CATEGORIA_FILA_ARRANQUE
                : undefined,
        attachments: fotograma
          ? [{ identifier: 'fotograma', url: fotograma, type: 'jpg' }]
          : undefined,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 1,
              channelId: CHANNEL_ID,
            }
          : null,
    });
  } catch (error) {
    log('could not schedule notification', error);
  }
};
