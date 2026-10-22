import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';

const SLIDES = [
  {
    overline: 'BEM-VINDO',
    title: 'A sua impressora, no seu bolso',
    body: 'Veja a câmara, consulte as temperaturas e pause uma impressão a partir de qualquer ponto da sua rede.',
    icon: null,
  },
  {
    overline: 'AVISO',
    title: 'Sem afiliação com a Elegoo',
    body: 'É uma aplicação independente, criada pela comunidade. A sua impressora comunica com ela diretamente através da rede local — nada passa por nós.',
    icon: 'shield-checkmark-outline',
  },
  {
    overline: 'CÓDIGO ABERTO',
    title: 'Criado pela comunidade',
    body: 'Sob licença MIT e com desenvolvimento aberto. Avisos de erros e contribuições são bem-vindos.',
    icon: 'code-slash-outline',
  },
];

const WelcomeScreen = ({ onComplete }: { onComplete: () => void }) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const pagerRef = React.useRef<PagerView>(null);
  const [page, setPage] = React.useState(0);

  // Drives both the pager and local state: relying on onPageSelected alone
  // left the flow stuck on Android, so the last slide never completed.
  const goTo = (next: number) => {
    setPage(next);
    pagerRef.current?.setPage(next);
  };

  const handleNext = () => {
    if (page < SLIDES.length - 1) {
      goTo(page + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (page > 0) {
      goTo(page - 1);
    }
  };

  const handleGitHubPress = async () => {
    const url = 'https://github.com/WalkerFrederick/CC-Tool';
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a ligação.');
    }
  };

  const isLast = page === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-canvas">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <PagerView
        style={{ flex: 1 }}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={e => setPage(e.nativeEvent.position)}
        scrollEnabled
      >
        {SLIDES.map(slide => (
          <View
            key={slide.title}
            style={{ flex: 1 }}
            className="px-8 justify-center"
          >
            <View className="items-center">
              {slide.icon ? (
                <View className="w-[88px] h-[88px] rounded-[26px] bg-brand-soft items-center justify-center">
                  <Ionicons
                    name={slide.icon as any}
                    size={38}
                    color="#3E6AE1"
                  />
                </View>
              ) : (
                <Image
                  source={require('../../assets/CC.png')}
                  style={{ width: 88, height: 88 }}
                  resizeMode="contain"
                />
              )}

              <Text className="mt-8 text-[10px] tracking-widest font-semibold text-ink-soft">
                {slide.overline}
              </Text>
              <Text className="mt-2 text-[26px] leading-[32px] font-bold text-ink text-center">
                {slide.title}
              </Text>
              <Text className="mt-3 text-[14px] leading-[21px] text-ink-muted text-center">
                {slide.body}
              </Text>

              {slide.overline === 'CÓDIGO ABERTO' && (
                <TouchableOpacity
                  onPress={handleGitHubPress}
                  className="mt-6 flex-row items-center rounded-xl2 border border-line px-4 py-2.5"
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-github" size={16} color="#171A20" />
                  <Text className="ml-2 text-[13px] font-semibold text-ink">
                    Ver no GitHub
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </PagerView>

      <View className="flex-row justify-center items-center pb-6">
        {SLIDES.map((slide, index) => (
          <View
            key={slide.title}
            className={`h-1.5 rounded-full mx-1 ${
              index === page ? 'w-6 bg-brand' : 'w-1.5 bg-[#D6D8DB]'
            }`}
          />
        ))}
      </View>

      <View className="flex-row px-6 pb-6">
        {page > 0 && (
          <TouchableOpacity
            onPress={handleBack}
            className="flex-1 mr-2 rounded-xl2 border border-line py-3.5 items-center"
            activeOpacity={0.7}
          >
            <Text className="text-[15px] font-semibold text-ink-soft">
              Anterior
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleNext}
          className="flex-1 rounded-xl2 bg-brand py-3.5 items-center"
          activeOpacity={0.85}
        >
          <Text className="text-[15px] font-semibold text-white">
            {isLast ? 'Começar' : 'Seguinte'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
