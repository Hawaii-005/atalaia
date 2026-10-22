import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const WhereIsIpScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-canvas-sunken dark:bg-gray-900">
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-2xl font-bold text-ink dark:text-gray-100 text-center mt-5">
          Como Encontrar o Endereço IP da Sua Impressora
        </Text>
        <Text className="text-base text-ink-soft dark:text-gray-300 text-center mt-4 leading-6">
          Na CC, encontra o endereço IP da sua impressora tocando no botão
          &quot;Definições&quot; e depois em &quot;Rede&quot;, no topo.
        </Text>
        <Text className="text-base text-ink-soft dark:text-gray-300 text-center mt-4 leading-6">
          Certifique-se de que o telemóvel está ligado à mesma rede Wi-Fi da
          impressora!
        </Text>
      </View>
      <View className="p-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-brand rounded-lg py-4"
        >
          <Text className="text-white text-center font-bold text-lg">
            Adicionar impressora
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default WhereIsIpScreen;
