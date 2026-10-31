import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import {
  SettingsScreen,
  HistoryScreen,
  FilesScreen,
  StatsScreen,
} from '../screens';
import { PrinterDetailsScreen } from '../screens/PrinterDetailsScreen';
import { AddEditPrinterScreen } from '../screens/AddEditPrinterScreen';
import { DiscoveryScreen } from '../screens/DiscoveryScreen';
import { ResinScreen } from '../screens/ResinScreen';
import { CameraScreen } from '../screens/CameraScreen';
import WhereIsIpScreen from '../screens/WhereIsIpScreen';
import { InicioScreen } from '../screens/InicioScreen';
import { FilaScreen } from '../screens/FilaScreen';
import { InventarioScreen } from '../screens/InventarioScreen';
import { PrinterTabScreen } from '../screens/PrinterTabScreen';
import { EditarIpScreen } from '../screens/EditarIpScreen';
import PrinterIcon from '../components/icons/PrinterIcon';
import { RailLateral } from '../components/RailLateral';
import { useJanela } from '../theme/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t, useIdioma } from '../i18n';

const Tab = createBottomTabNavigator();
const Gaveta = createDrawerNavigator();
const Root = createStackNavigator();

/**
 * Três abas: Início, Impressora (pílulas + secções) e Definições.
 *
 * Tudo o que se abre por cima — câmara, histórico, adicionar, descobrir, IP,
 * detalhe antigo — vive num único stack raiz, para não haver o mesmo ecrã
 * registado em três sítios.
 */
const Abas = () => {
  useIdioma();
  const { tema } = useTheme();
  // A altura fixa da barra tem de incluir a área do gesto: sem isto, num
  // telemóvel com navegação por gestos (S25) as legendas ficam a 23 dp do
  // fundo e a barra do sistema passa por cima.
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Inicio') {
            return (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={size}
                color={color}
              />
            );
          }
          if (route.name === 'Impressora') {
            return (
              <PrinterIcon
                variant={focused ? 'filled' : 'outline'}
                size={size}
                color={color}
              />
            );
          }
          return (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={color}
            />
          );
        },
        tabBarActiveTintColor: hexDe(tema.paleta.acentoTexto),
        tabBarInactiveTintColor: hexDe(tema.paleta.tintaSoft),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginTop: 2,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: hexDe(tema.paleta.cartao),
          borderTopWidth: 1,
          borderTopColor: hexDe(tema.paleta.linha),
          paddingBottom: 6 + insets.bottom,
          paddingTop: 6,
          height: 66 + insets.bottom,
        },
      })}
    >
      <Tab.Screen
        name="Inicio"
        component={InicioScreen}
        options={{ title: t('inicio.titulo') }}
      />
      <Tab.Screen
        name="Impressora"
        component={PrinterTabScreen}
        options={{ title: t('aba.impressora') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('settings.title') }}
      />
    </Tab.Navigator>
  );
};

/** Tablet: rail à esquerda em vez da barra inferior. */
const ShellLargo = () => {
  const { tema } = useTheme();

  return (
    <Gaveta.Navigator
      drawerContent={props => <RailLateral {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'permanent',
        drawerStyle: {
          width: 88,
          backgroundColor: hexDe(tema.paleta.cartao),
        },
      }}
    >
      <Gaveta.Screen name="Inicio" component={InicioScreen} />
      <Gaveta.Screen name="Impressora" component={PrinterTabScreen} />
      <Gaveta.Screen name="Settings" component={SettingsScreen} />
    </Gaveta.Navigator>
  );
};

const Conteudo = () => {
  const { compacta } = useJanela();
  return compacta ? <Abas /> : <ShellLargo />;
};

export const AppNavigator = () => (
  <Root.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
    <Root.Screen name="Abas" component={Conteudo} />
    <Root.Screen name="Camera" component={CameraScreen} />
    <Root.Screen name="History" component={HistoryScreen} />
    <Root.Screen name="Files" component={FilesScreen} />
    <Root.Screen name="Stats" component={StatsScreen} />
    <Root.Screen name="PrinterDetails" component={PrinterDetailsScreen} />
    <Root.Screen name="AddEditPrinter" component={AddEditPrinterScreen} />
    <Root.Screen name="Discovery" component={DiscoveryScreen} />
    <Root.Screen name="WhereIsIp" component={WhereIsIpScreen} />
    <Root.Screen name="EditarIp" component={EditarIpScreen} />
    <Root.Screen name="Resina" component={ResinScreen} />
    <Root.Screen name="Fila" component={FilaScreen} />
    <Root.Screen name="Inventario" component={InventarioScreen} />
  </Root.Navigator>
);
