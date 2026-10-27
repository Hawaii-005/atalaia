import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t, useIdioma } from '../i18n';
import { Mascote } from '../ui/Mascote';

const SLIDES = [
  {
    overlineKey: 'welcome.overlineBemVindo',
    titleKey: 'welcome.titulo1',
    bodyKey: 'welcome.corpo1',
    icon: null,
    github: false,
  },
  {
    overlineKey: 'welcome.overlineAviso',
    titleKey: 'welcome.titulo2',
    bodyKey: 'welcome.corpo2',
    icon: 'shield-checkmark-outline',
    github: false,
  },
  {
    overlineKey: 'welcome.overlineCodigoAberto',
    titleKey: 'welcome.titulo3',
    bodyKey: 'welcome.corpo3',
    icon: 'code-slash-outline',
    github: true,
  },
];

const WelcomeScreen = ({ onComplete }: { onComplete: () => void }) => {
  useIdioma();
  const { escuro: isDark, tema } = useTheme();
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
    const url = 'https://github.com/Hawaii-005/atalaia';
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(t('comum.erro'), t('comum.erroLigacao'));
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
            key={slide.titleKey}
            style={{ flex: 1 }}
            className="px-8 justify-center"
          >
            <View className="items-center">
              {slide.icon ? (
                <View className="w-[88px] h-[88px] rounded-[26px] bg-brand-soft items-center justify-center">
                  <Ionicons
                    name={slide.icon as any}
                    size={38}
                    color={hexDe(tema.paleta.acento)}
                  />
                </View>
              ) : (
                <Mascote pose="ocioso" tamanho={132} />
              )}

              <Text className="mt-8 text-[10px] tracking-widest font-semibold text-ink-soft">
                {t(slide.overlineKey)}
              </Text>
              <Text className="mt-2 text-[26px] leading-[32px] font-bold text-ink text-center">
                {t(slide.titleKey)}
              </Text>
              <Text className="mt-3 text-[14px] leading-[21px] text-ink-muted text-center">
                {t(slide.bodyKey)}
              </Text>

              {slide.github && (
                <TouchableOpacity
                  onPress={handleGitHubPress}
                  className="mt-6 flex-row items-center rounded-xl2 border border-line px-4 py-2.5"
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-github" size={16} color={hexDe(tema.paleta.tinta)} />
                  <Text className="ml-2 text-[13px] font-semibold text-ink">
                    {t('welcome.verGithub')}
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
            key={slide.titleKey}
            className={`h-1.5 rounded-full mx-1 ${
              index === page ? 'w-6 bg-brand' : 'w-1.5 bg-line'
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
              {t('welcome.anterior')}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleNext}
          className="flex-1 rounded-xl2 bg-brand py-3.5 items-center"
          activeOpacity={0.85}
        >
          <Text className="text-[15px] font-semibold text-white">
            {isLast ? t('welcome.comecar') : t('welcome.seguinte')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
