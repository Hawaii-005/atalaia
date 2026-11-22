import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

type Modal05bRouteProp = RouteProp<{ [key: string]: any }, 'Modal05b'>;

export function ModalArranqueBloqueadoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Modal05bRouteProp>();

  const bloqueados = route.params?.bloqueados || [
    {
      id: 'slice',
      nome: 'Slice 3D',
      razao: 'Requer licença de faturamento ativa',
    },
    {
      id: 'upload',
      nome: 'Upload G-code',
      razao: 'Conexão Moonraker não configurada',
    },
  ];

  const fechar = () => navigation.goBack();
  const configurar = () => {
    // Navegar para as definições relevantes
    navigation.navigate('Settings' as never);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <View className="flex-1 items-center justify-center p-4">
        {/* Backdrop - clique fora fecha */}
        <TouchableOpacity
          className="absolute inset-0 bg-black/50"
          activeOpacity={1}
          onPress={fechar}
        />

        {/* Modal */}
        <View className="bg-[#141226] rounded-2xl p-6 w-full max-w-md">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 bg-gradient-to-r from-[#ff4757] to-[#ff6b81] rounded-full items-center justify-center">
              <Ionicons name="information-circle" size={24} color="#FFFFFF" />
            </View>
            <View>
              <Text className="text-xl font-bold text-ink">
                Arranque Bloqueado
              </Text>
              <Text className="text-gray-400 text-sm mt-1">
                A função está temporariamente indisponível
              </Text>
            </View>
          </View>

          <ScrollView className="mb-6">
            {bloqueados.map((item: any) => (
              <View key={item.id} className="bg-[#1a1225] rounded-xl p-4 mb-3">
                <Text className="text-ink font-medium mb-1">{item.nome}</Text>
                <Text className="text-gray-400 text-sm">{item.razao}</Text>
              </View>
            ))}
          </ScrollView>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-[#333] rounded-xl py-4 items-center"
              onPress={fechar}
            >
              <Text className="text-ink font-medium">Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl py-4 items-center"
              onPress={configurar}
            >
              <Text className="text-white font-medium">Configurar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
