import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import {
  HomeScreen,
  SettingsScreen,
  HistoryScreen,
  FilesScreen,
  StatsScreen,
} from '../screens';
import { PrinterDetailsScreen } from '../screens/PrinterDetailsScreen';
import { AddEditPrinterScreen } from '../screens/AddEditPrinterScreen';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { MonitorScreen } from '../screens/MonitorScreen';
import { ResinScreen } from '../screens/ResinScreen';
import { CameraScreen } from '../screens/CameraScreen';
import WhereIsIpScreen from '../screens/WhereIsIpScreen';
import PrinterIcon from '../components/icons/PrinterIcon';
import { useTheme } from '../contexts/ThemeContext';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const PrintersStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'none',
    }}
  >
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="PrinterDetails" component={PrinterDetailsScreen} />
    <Stack.Screen name="AddEditPrinter" component={AddEditPrinterScreen} />
    <Stack.Screen name="Discovery" component={DiscoveryScreen} />
    <Stack.Screen name="WhereIsIp" component={WhereIsIpScreen} />
    <Stack.Screen name="History" component={HistoryScreen} />
    <Stack.Screen name="Files" component={FilesScreen} />
    <Stack.Screen name="Stats" component={StatsScreen} />
    <Stack.Screen name="Resina" component={ResinScreen} />
  </Stack.Navigator>
);

const MonitorStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'none',
    }}
  >
    <Stack.Screen name="MonitorHome" component={MonitorScreen} />
    <Stack.Screen name="Camera" component={CameraScreen} />
    <Stack.Screen name="Resina" component={ResinScreen} />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { tema } = useTheme();
  const { printers } = usePrinterConnections();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Printers') {
            return (
              <PrinterIcon
                variant={focused ? 'filled' : 'outline'}
                size={size}
                color={color}
              />
            );
          } else if (route.name === 'Monitor') {
            // A aba mostra vídeo quando há câmara e trabalho quando só há resina.
            const temCamera = printers.some(p => p.kind !== 'resin');
            return (
              <Ionicons
                name={
                  temCamera
                    ? focused
                      ? 'videocam'
                      : 'videocam-outline'
                    : focused
                    ? 'layers'
                    : 'layers-outline'
                }
                size={size}
                color={color}
              />
            );
          } else if (route.name === 'Settings') {
            return (
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={size}
                color={color}
              />
            );
          } else {
            return <Ionicons name="help-outline" size={size} color={color} />;
          }
        },
        tabBarActiveTintColor: hexDe(tema.paleta.acentoTexto),
        tabBarInactiveTintColor: hexDe(tema.paleta.tintaSoft),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.6,
          marginTop: 2,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: hexDe(tema.paleta.cartao),
          borderTopWidth: 1,
          borderTopColor: hexDe(tema.paleta.linha),
          paddingBottom: 6,
          paddingTop: 6,
          height: 66,
        },
      })}
    >
      <Tab.Screen
        name="Printers"
        component={PrintersStackNavigator}
        options={{
          title: t('home.title'),
        }}
      />
      <Tab.Screen
        name="Monitor"
        component={MonitorStackNavigator}
        options={{
          title: t('monitor.titulo'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings.title'),
        }}
      />
    </Tab.Navigator>
  );
};
