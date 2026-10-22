import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
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
 * Miniatura do G-code com zoom por pinca. O zoom muda a janela do `viewBox`
 * (zoom vectorial a sério) em vez de `transform: scale` — o scale desaparecia
 * dentro do `overflow: hidden` do painel em Android.
 */
export const ZoomThumb = ({ path, altura = 240 }: Props) => {
  const { tema } = useTheme();
  const [nivel, setNivel] = useState(1);
  const [centro, setCentro] = useState({ x: 50, y: 50 });
  const escala = useSharedValue(1);
  const base = useSharedValue(1);

  const aplicarNivel = (v: number) => setNivel(Math.round(v * 4) / 4);
  const aplicarCentro = (x: number, y: number) => setCentro({ x, y });

  const repor = () => {
    escala.value = 1;
    setNivel(1);
    setCentro({ x: 50, y: 50 });
  };

  const pinca = Gesture.Pinch()
    .onStart(() => {
      base.value = escala.value;
    })
    .onUpdate(evento => {
      escala.value = limitar(base.value * evento.scale);
      runOnJS(aplicarNivel)(escala.value);
    })
    .onEnd(() => {
      runOnJS(aplicarNivel)(escala.value);
    });

  const arrasto = Gesture.Pan()
    .averageTouches(true)
    .onUpdate(evento => {
      if (escala.value <= 1.05) return;
      const janela = 100 / escala.value;
      const passo = janela / (altura - 16);
      runOnJS(aplicarCentro)(
        Math.min(100 - janela / 2, Math.max(janela / 2, 50 - evento.translationX * passo)),
        Math.min(100 - janela / 2, Math.max(janela / 2, 50 - evento.translationY * passo))
      );
    });

  const duploToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const proximo = escala.value > 1.05 ? 1 : 3;
      escala.value = proximo;
      runOnJS(aplicarNivel)(proximo);
      if (proximo === 1) runOnJS(aplicarCentro)(50, 50);
    });

  const gestos = Gesture.Simultaneous(pinca, arrasto, duploToque);

  const janela = 100 / nivel;
  const x0 = centro.x - janela / 2;
  const y0 = centro.y - janela / 2;

  return (
    <GestureHandlerRootView style={{ width: '100%' }}>
      <View
        className="w-full rounded-xl border border-line bg-cartao overflow-hidden items-center justify-center"
        style={{ height: altura }}
      >
        <GestureDetector gesture={gestos}>
          <View>
            <Svg
              viewBox={`${x0} ${y0} ${janela} ${janela}`}
              width={altura - 16}
              height={altura - 16}
            >
              <Path
                d={path}
                stroke={hexDe(tema.paleta.tinta)}
                strokeWidth={0.5 / nivel}
                fill="none"
              />
            </Svg>
          </View>
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
