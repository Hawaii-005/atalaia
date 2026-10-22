import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';

const MIN = 1;
const MAX = 8;

const distancia = (a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) =>
  Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Props = {
  /** caminho SVG do contorno do modelo */
  path: string;
  /** altura da área visível */
  altura?: number;
};

/**
 * Miniatura do G-code com zoom por pinca (dois dedos) e arrasto quando ampliada.
 * O desenho é vectorial, por isso ampliar não perde nitidez.
 */
export const ZoomThumb = ({ path, altura = 240 }: Props) => {
  const { tema } = useTheme();
  const escala = useRef(new Animated.Value(1)).current;
  const desvioX = useRef(new Animated.Value(0)).current;
  const desvioY = useRef(new Animated.Value(0)).current;
  const actual = useRef({ escala: 1, x: 0, y: 0 });
  const inicio = useRef({ escala: 1, x: 0, y: 0, pinca: 0, x0: 0, y0: 0 });
  const [nivel, setNivel] = useState(1);

  const aplicar = () => {
    escala.setValue(actual.current.escala);
    desvioX.setValue(actual.current.x);
    desvioY.setValue(actual.current.y);
  };

  const repor = () => {
    actual.current = { escala: 1, x: 0, y: 0 };
    inicio.current.pinca = 0;
    setNivel(1);
    Animated.parallel([
      Animated.spring(escala, { toValue: 1, useNativeDriver: true }),
      Animated.spring(desvioX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(desvioY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // dois dedos ganham sempre ao ScrollView que envolve o painel
        onMoveShouldSetPanResponderCapture: event =>
          event.nativeEvent.touches.length >= 2,
        onPanResponderGrant: event => {
          const toques = event.nativeEvent.touches;
          inicio.current = {
            escala: actual.current.escala,
            x: actual.current.x,
            y: actual.current.y,
            pinca: toques.length >= 2 ? distancia(toques[0], toques[1]) : 0,
            x0: toques[0]?.pageX ?? 0,
            y0: toques[0]?.pageY ?? 0,
          };
        },
        onPanResponderMove: (event, gesto) => {
          const toques = event.nativeEvent.touches;
          if (toques.length >= 2) {
            const d = distancia(toques[0], toques[1]);
            if (!inicio.current.pinca) {
              inicio.current.pinca = d;
              inicio.current.escala = actual.current.escala;
            }
            const s = limitar(
              (inicio.current.escala * d) / (inicio.current.pinca || d),
              MIN,
              MAX
            );
            actual.current.escala = s;
            escala.setValue(s);
            return;
          }
          if (toques.length === 1 && actual.current.escala > 1) {
            actual.current.x = inicio.current.x + gesto.dx;
            actual.current.y = inicio.current.y + gesto.dy;
            desvioX.setValue(actual.current.x);
            desvioY.setValue(actual.current.y);
          }
        },
        onPanResponderRelease: () => {
          inicio.current.pinca = 0;
          setNivel(actual.current.escala);
          if (actual.current.escala < 1.05) {
            repor();
          }
        },
        onPanResponderTerminate: () => {
          inicio.current.pinca = 0;
          setNivel(actual.current.escala);
        },
      }),
    []
  );

  return (
    <View>
      <View
        className="w-full rounded-xl border border-line bg-cartao overflow-hidden items-center justify-center"
        style={{ height: altura }}
        {...responder.panHandlers}
      >
        <Animated.View
          style={{
            transform: [
              { translateX: desvioX },
              { translateY: desvioY },
              { scale: escala },
            ],
          }}
        >
          <Svg viewBox="0 0 100 100" width={altura - 16} height={altura - 16}>
            <Path
              d={path}
              stroke={hexDe(tema.paleta.tinta)}
              strokeWidth={0.5}
              fill="none"
            />
          </Svg>
        </Animated.View>

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
    </View>
  );
};
