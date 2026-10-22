import { log } from './log';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

export const notify = async (
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
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
