import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface PulsingDotProps {
  cor: string;
  tamanho?: number;
  pulsar?: boolean;
  style?: ViewStyle;
}

/**
 * Ponto de estado animado com pulso suave a 60fps usando o driver nativo.
 * poncho: ceiling animation loop; zero bridge overhead.
 */
export const PulsingDot: React.FC<PulsingDotProps> = ({
  cor,
  tamanho = 6,
  pulsar = true,
  style,
}) => {
  const opacidade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulsar) {
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
  }, [pulsar, opacidade]);

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
