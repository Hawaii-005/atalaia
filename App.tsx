import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { hexDe } from './src/theme/temas';
import {
  PrinterConnectionsProvider,
  usePrinterConnections,
} from './src/contexts/PrinterConnectionsContext';
import { usePrintNotifications } from './src/hooks/usePrintNotifications';
import { prepareNotifications } from './src/utils/notifications';
import WelcomeScreen from './src/screens/WelcomeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';

import './global.css';

function AppContent() {
  const { escuro, tema } = useTheme();
  const { printers } = usePrinterConnections();
  usePrintNotifications(printers);

  useEffect(() => {
    prepareNotifications();
  }, []);

  const base = escuro ? DarkTheme : DefaultTheme;
  const paleta = tema.paleta;
  const temaNavegacao = {
    ...base,
    colors: {
      ...base.colors,
      background: hexDe(paleta.fundo),
      card: hexDe(paleta.cartao),
      text: hexDe(paleta.tinta),
      border: hexDe(paleta.linha),
      primary: hexDe(paleta.acento),
    },
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(hexDe(paleta.fundo));
      NavigationBar.setButtonStyleAsync(escuro ? 'light' : 'dark');
    }
  }, [escuro, paleta.fundo]);

  return (
    <NavigationContainer theme={temaNavegacao}>
      <StatusBar style={escuro ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

function AppLogic() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        if (hasLaunched === null) {
          setShowWelcome(true);
        }
      } catch (error) {
        console.error('Failed to load launch status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkFirstLaunch();
  }, []);

  const handleWelcomeComplete = async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      setShowWelcome(false);
    } catch (error) {
      console.error('Failed to save launch status:', error);
    }
  };

  if (isLoading) {
    return null; // or a loading spinner
  }

  if (showWelcome) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  return (
    <PrinterConnectionsProvider>
      <AppContent />
    </PrinterConnectionsProvider>
  );
}

/** Aplica as variáveis do tema na raiz — todas as classNames (bg-canvas,
 *  text-ink, border-line…) passam a ler o tema escolhido. */
function RaizTematica() {
  const { vars: variaveisTema, tema } = useTheme();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: hexDe(tema.paleta.fundo) },
        vars(variaveisTema),
      ]}
    >
      <AppLogic />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <RaizTematica />
    </ThemeProvider>
  );
}
