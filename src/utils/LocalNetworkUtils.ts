import { Platform, Alert, Linking } from 'react-native';
import { t } from '../i18n';
import {
  checkLocalNetworkAccess,
  requestLocalNetworkAccess,
} from '@generac/react-native-local-network-permission';

export const checkLocalNetworkPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return true; // No permission needed on Android
  }

  try {
    // First, request local network access to ensure the dialog appears
    await requestLocalNetworkAccess();

    // Then check if we have access
    const hasAccess = await checkLocalNetworkAccess();

    if (!hasAccess) {
      Alert.alert(t('network.permissionTitle'), t('network.permissionBody'), [
        {
          text: t('comum.cancelar'),
          style: 'cancel',
        },
        {
          text: t('network.openSettings'),
          onPress: () => {
            Linking.openSettings();
          },
        },
      ]);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking local network access:', error);
    Alert.alert(
      t('network.permissionErrorTitle'),
      t('network.permissionErrorBody'),
      [{ text: 'OK' }]
    );
    return false;
  }
};
