import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';

const MIN = 1;
const MAX = 8;
const limitar = (v: number) => Math.min(MAX, Math.max(MIN, v));

type Props = {
  /** caminho SVG do contorno do modelo */
  path: string;
  /** altura da área visível */
  altura?: number;
};

/**
 * Miniatura do G-code com zoom por pinca e arrasto. Usa o gesture-handler
 * nativo — o PanResponder era engolido pelo ScrollView do painel.
 * O desenho é vectorial: ampliar não perde nitidez.
 */
export const ZoomThumb = ({ path, altura = 240 }: Props) => {
  const { tema } = useTheme();
  const escala = useSharedValue(1);
  const guardada = useSharedValue(1);
  const desvioX = useSharedValue(0);
  const desvioY = useSharedValue(0);
  const guardadoX = useSharedValue(0);
  const guardadoY = useSharedValue(0);
  const [nivel, setNivel] = useState(1);

  const repor = () => {
    escala.value = withTiming(1, { duration: 160 });
    desvioX.value = withTiming(0, { duration: 160 });
    desvioY.value = withTiming(0, { duration: 160 });
    guardada.value = 1;
    guardadoX.value = 0;
    guardadoY.value = 0;
    setNivel(1);
  };

  const pinca = Gesture.Pinch()
    .onUpdate(evento => {
      escala.value = limitar(guardada.value * evento.scale);
    })
    .onEnd(() => {
      if (escala.value < 1.05) {
        escala.value = withTiming(1, { duration: 160 });
        desvioX.value = withTiming(0, { duration: 160 });
        desvioY.value = withTiming(0, { duration: 160 });
        guardada.value = 1;
        guardadoX.value = 0;
        guardadoY.value = 0;
        runOnJS(setNivel)(1);
      } else {
        guardada.value = escala.value;
        runOnJS(setNivel)(escala.value);
      }
    });

  const arrasto = Gesture.Pan()
    .averageTouches(true)
    .minPointers(1)
    .onUpdate(evento => {
      if (escala.value <= 1) return;
      desvioX.value = guardadoX.value + evento.translationX;
      desvioY.value = guardadoY.value + evento.translationY;
    })
    .onEnd(() => {
      guardadoX.value = desvioX.value;
      guardadoY.value = desvioY.value;
    });

  const duploToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (escala.value > 1.05) {
        escala.value = withTiming(1, { duration: 160 });
        desvioX.value = withTiming(0, { duration: 160 });
        desvioY.value = withTiming(0, { duration: 160 });
        guardada.value = 1;
        guardadoX.value = 0;
        guardadoY.value = 0;
        runOnJS(setNivel)(1);
      } else {
        escala.value = withTiming(3, { duration: 180 });
        guardada.value = 3;
        runOnJS(setNivel)(3);
      }
    });

  const gestos = Gesture.Simultaneous(pinca, arrasto, duploToque);

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateX: desvioX.value },
      { translateY: desvioY.value },
      { scale: escala.value },
    ],
  }));

  return (
    <GestureHandlerRootView>
      <View
        className="w-full rounded-xl border border-line bg-cartao overflow-hidden items-center justify-center"
        style={{ height: altura }}
      >
        <GestureDetector gesture={gestos}>
          <Animated.View style={estilo}>
            <Svg viewBox="0 0 100 100" width={altura - 16} height={altura - 16}>
              <Path
                d={path}
                stroke={hexDe(tema.paleta.tinta)}
                strokeWidth={0.5}
                fill="none"
              />
            </Svg>
          </Animated.View>
        </GestureDetector>

        {nivel > 1.05 && (
          <TouchableOpacity
            onPress={repor}
            className="absolute right-2 bottom-2 px-2.5 py-1 rounded-md border border-line bg-canvas"
          >
            <Text className="text-[10px] font-semibold text-ink-soft">
              {nivel.toFixed(1)}× · {t('files.reporZoom')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text className="text-[10px] text-ink-muted mt-1.5 text-center">
        {t('files.dicaZoom')}
      </Text>
    </GestureHandlerRootView>
  );
};
