import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { t, useIdioma } from '../i18n';

const WhereIsIpScreen = () => {
  useIdioma();
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-canvas-sunken dark:bg-gray-900">
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-2xl font-bold text-ink dark:text-gray-100 text-center mt-5">
          {t('ip.title')}
        </Text>
        <Text className="text-base text-ink-soft dark:text-gray-300 text-center mt-4 leading-6">
          {t('ip.corpo1')}
        </Text>
        <Text className="text-base text-ink-soft dark:text-gray-300 text-center mt-4 leading-6">
          {t('ip.corpo2')}
        </Text>
      </View>
      <View className="p-4">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-brand rounded-lg py-4"
        >
          <Text className="text-white text-center font-bold text-lg">
            {t('ip.adicionarImpressora')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default WhereIsIpScreen;
