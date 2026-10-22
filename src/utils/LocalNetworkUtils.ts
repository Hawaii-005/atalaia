import { Platform, Alert, Linking } from 'react-native';
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
      Alert.alert(
        'Acesso à rede local necessário',
        'Esta app precisa de acesso à rede local para ligar às impressoras. Activa o acesso em Definições para continuar.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Abrir definições',
            onPress: () => {
              Linking.openSettings();
            },
          },
        ]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking local network access:', error);
    Alert.alert(
      'Erro de acesso à rede',
      'Não foi possível verificar o acesso à rede local. Confirma as permissões.',
      [{ text: 'OK' }]
    );
    return false;
  }
};
