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
import { CameraScreen } from '../screens/CameraScreen';
import WhereIsIpScreen from '../screens/WhereIsIpScreen';
import PrinterIcon from '../components/icons/PrinterIcon';
import { useTheme } from '../contexts/ThemeContext';

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
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { colorScheme } = useTheme();

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
          } else if (route.name === 'Camera') {
            return (
              <Ionicons
                name={focused ? 'videocam' : 'videocam-outline'}
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
        tabBarActiveTintColor: '#3E6AE1',
        tabBarInactiveTintColor: '#9AA0A6',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.6,
          marginTop: 2,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#111827' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: colorScheme === 'dark' ? '#1F2937' : '#E4E4E4',
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
          title: 'Impressoras',
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: 'Câmara',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Definições',
        }}
      />
    </Tab.Navigator>
  );
};
