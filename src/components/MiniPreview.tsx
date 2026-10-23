import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';
import type { EstadoPrevia } from '../utils/revelacao';
import { limitarProgresso } from '../utils/revelacao';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

export type { EstadoPrevia } from '../utils/revelacao';

interface Props {
  uri: string;
  progresso: number;
  estado: EstadoPrevia;
  altura?: number;
  /** Texto para leitores de ecrã (já traduzido por quem usa o componente). */
  rotulo?: string;
}

const ALTURA_POR_OMISSAO = 260;
const SEGMENTOS = 24;

/**
 * Pré-visualização com revelação progressiva de baixo para cima.
 *
 * Três camadas, todas com a mesma imagem e a mesma altura para o recorte
 * coincidir pixel a pixel:
 * 1. fantasma a 22 % — o que ainda falta imprimir;
 * 2. recorte sólido ancorado em baixo, com altura proporcional ao progresso;
 * 3. frente de impressão: linha de 2 dp + halo de 28 dp.
 *
 * Com a máquina desligada mostra a imagem inteira a 45 % (último estado
 * conhecido, sem inventar progresso). Em pausa a frente passa a tracejado
 * cinzento. Parada fica congelada, sem frente.
 */
export const MiniPreview: React.FC<Props> = ({
  uri,
  progresso,
  estado,
  altura = ALTURA_POR_OMISSAO,
  rotulo,
}) => {
  const { tema } = useTheme();
  const p = limitarProgresso(progresso);

  const anim = useRef(new Animated.Value(p)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: p,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height/top não correm no thread nativo
    }).start();
  }, [p, anim]);

  const revelar =
    estado === 'a-imprimir' || estado === 'em-pausa' || estado === 'parada';
  const comFrente = estado === 'a-imprimir' || estado === 'em-pausa';
  const emPausa = estado === 'em-pausa';
  const semLigacao = estado === 'sem-ligacao';

  const corAcento = hexDe(tema.paleta.acento);
  const corMuted = hexDe(tema.paleta.tintaMuted);
  const corFrente = emPausa ? corMuted : corAcento;

  const alturaVisivel = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, altura],
  });
  const topoFrenteAnim = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [altura, 0],
  });

  return (
    <View
      style={[styles.frame, { height: altura, backgroundColor: hexDe(tema.paleta.fundoBaixo) }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}
      accessibilityLabel={rotulo}
    >
      {revelar ? (
        <>
          {/* 1. fantasma — o que falta imprimir */}
          <Image
            source={{ uri }}
            style={[styles.img, { height: altura, opacity: 0.22 }]}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />

          {/* 2. já impresso — recorte ancorado em baixo */}
          <Animated.View style={[styles.clip, { height: alturaVisivel }]}>
            <Image
              source={{ uri }}
              style={[styles.img, { height: altura }]}
              resizeMode="contain"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </Animated.View>

          {/* 3. frente de impressão: linha de 2 dp + halo */}
          {comFrente ? (
            <Animated.View
              style={[styles.front, { top: topoFrenteAnim }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {emPausa ? (
                <View style={styles.tracejado}>
                  {Array.from({ length: SEGMENTOS }).map((_, i) => (
                    <View
                      key={i}
                      style={[styles.segmento, { backgroundColor: corMuted }]}
                    />
                  ))}
                </View>
              ) : (
                <View style={[styles.linha, { backgroundColor: corFrente }]} />
              )}
              <View
                style={[
                  styles.halo,
                  { backgroundColor: corFrente, opacity: emPausa ? 0.12 : 0.14 },
                ]}
              />
            </Animated.View>
          ) : null}
        </>
      ) : (
        <Image
          source={{ uri }}
          style={[styles.img, { height: altura, opacity: semLigacao ? 0.45 : 1 }]}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  img: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
  },
  clip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  front: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  linha: {
    height: 2,
  },
  tracejado: {
    height: 2,
    flexDirection: 'row',
  },
  segmento: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
  },
  halo: {
    height: 28,
  },
});
