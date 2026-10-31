import React, { useEffect, useRef, useState } from 'react';
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

  // O enquadramento acompanha o formato da própria imagem: assim não ficam
  // faixas vazias nas laterais quando a prévia do .ctb é vertical.
  const [larguraCaixa, setLarguraCaixa] = useState(0);
  const [aspeto, setAspeto] = useState(0.64);
  useEffect(() => {
    Image.getSize(
      uri,
      (w, h) => {
        if (w > 0 && h > 0) setAspeto(w / h);
      },
      () => {}
    );
  }, [uri]);
  const largura = larguraCaixa
    ? Math.min(larguraCaixa, altura * aspeto)
    : undefined;

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
  const comLinha = comFrente || estado === 'parada';
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
      style={styles.casca}
      onLayout={e => setLarguraCaixa(e.nativeEvent.layout.width)}
    >
      <View
        style={[
          styles.frame,
          {
            height: altura,
            width: largura ?? '100%',
            backgroundColor: hexDe(tema.paleta.fundoBaixo),
          },
        ]}
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
            {comLinha ? (
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
                  <View
                    style={[
                      styles.linha,
                      {
                        backgroundColor: comFrente ? corFrente : corMuted,
                        opacity: comFrente ? 1 : 0.55,
                      },
                    ]}
                  />
                )}
                {comFrente ? (
                  <View
                    style={[
                      styles.halo,
                      {
                        backgroundColor: corFrente,
                        opacity: emPausa ? 0.12 : 0.14,
                      },
                    ]}
                  />
                ) : null}
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Image
            source={{ uri }}
            style={[
              styles.img,
              { height: altura, opacity: semLigacao ? 0.45 : 1 },
            ]}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  casca: {
    alignItems: 'center',
  },
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
