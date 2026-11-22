import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';

type E5SentRouteProp = RouteProp<{ [key: string]: any }, 'E5Sent'>;

export function E5SentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<E5SentRouteProp>();
  const tema = useTheme();
  const paleta = tema.paleta;

  // Mock data - replace with real data from context/params
  const impressao = route.params?.impressao || {
    nome: 'cubo_teste.gcode',
    tamanho: '1.2 MB',
    camadas: 50,
    tempo: '1h 25min',
    impressora: 'Centauri Carbon',
    status: 'Enviado',
  };

  const cancelar = () => {
    // TODO: Implement cancelar impressão via Moonraker
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('comum.impressora')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView className="flex-1 p-4">
        {/* Status Card */}
        <View className="bg-[#1a1225] rounded-2xl p-6 items-center mb-6">
          <View className="w-20 h-20 bg-gradient-to-r from-[#4ecca3] to-[#00d2ff] rounded-full items-center justify-center mb-4">
            <Ionicons name="checkmark" size={32} color="#FFFFFF" />
          </View>
          <Text className="text-2xl font-bold text-ink mb-2">
            {t('e5.enviado_com_sucesso')}
          </Text>
          <Text className="text-gray-400 text-center">
            {t('e5.impressao_na_fila')}
          </Text>
        </View>

        {/* Informações da Impressão */}
        <View className="bg-[#141226] rounded-xl p-4 mb-6">
          <Text className="text-gray-300 text-sm mb-3">
            {t('e5.informacoes')}
          </Text>

          <View className="flex-row justify-between items-center py-3 border-b border-[#333]">
            <Text className="text-gray-400">{t('ficheiro')}</Text>
            <Text className="text-ink font-medium">{impressao.nome}</Text>
          </View>

          <View className="flex-row justify-between items-center py-3 border-b border-[#333]">
            <Text className="text-gray-400">{t('tamanho')}</Text>
            <Text className="text-ink font-medium">{impressao.tamanho}</Text>
          </View>

          <View className="flex-row justify-between items-center py-3 border-b border-[#333]">
            <Text className="text-gray-400">Camadas</Text>
            <Text className="text-ink font-medium">{impressao.camadas}</Text>
          </View>

          <View className="flex-row justify-between items-center py-3 border-b border-[#333]">
            <Text className="text-gray-400">{t('tempo_estimado')}</Text>
            <Text className="text-ink font-medium">{impressao.tempo}</Text>
          </View>

          <View className="flex-row justify-between items-center py-3">
            <Text className="text-gray-400">{t('impressora')}</Text>
            <Text className="text-ink font-medium">{impressao.impressora}</Text>
          </View>
        </View>

        {/* Ações */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-[#333] rounded-xl py-4 items-center"
            onPress={() => navigation.navigate('History')}
          >
            <Text className="text-ink font-medium">{t('ver_historico')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl py-4 items-center"
            onPress={cancelar}
          >
            <Text className="text-white font-medium">{t('cancelar')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
