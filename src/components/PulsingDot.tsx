import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ViewStyle } from 'react-native';

interface PulsingDotProps {
  cor: string;
  tamanho?: number;
  pulsar?: boolean;
  style?: ViewStyle;
}

/**
 * Ponto de estado animado com pulso suave a 60fps usando o driver nativo.
 * Respeita preferências do utilizador de redução de movimento (better-ui).
 * ponytail: static fallback on reduce motion; upgrade to custom timing if user requests bespoke easing.
 */
export const PulsingDot: React.FC<PulsingDotProps> = ({
  cor,
  tamanho = 6,
  pulsar = true,
  style,
}) => {
  const opacidade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (!pulsar || reduceMotion) {
      opacidade.setValue(1);
      return;
    }

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacidade, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    anim.start();
    return () => anim.stop();
  }, [pulsar, reduceMotion, opacidade]);

  return (
    <Animated.View
      style={[
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: cor,
          opacity: opacidade,
        },
        style,
      ]}
    />
  );
};
