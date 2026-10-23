import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';
import { EstadoPrevia, topoFrente } from '../utils/revelacao';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
export type { EstadoPrevia } from '../utils/revelacao';

interface Props {
  uri: string;
  progresso: number;
  estado: EstadoPrevia;
  altura?: number;
}

const ALTURA_POR_OMISSAO = 260;

/**
 * Pré-visualização com revelação progressiva de baixo para cima.
 *
 * Estrutura (de baixo para cima):
 * 1. Imagem fantasma (opacity 0.22) — o que falta imprimir
 * 2. Camada sólida recortada (overflow hidden, height animado) — o já impresso
 * 3. Frente de impressão: linha de 2 dp + halo de 28 dp
 *
 * Em 'concluida', 'repouso' ou 'parada': mostra a imagem inteira sem fantasma nem frente.
 * Em 'sem-ligacao': mostra só o fantasma (a 22 %).
 * Em 'em-pausa': linha tracejada cinzenta + halo cinzento a 12 %.
 */
export const MiniPreview: React.FC<Props> = ({
  uri,
  progresso,
  estado,
  altura = ALTURA_POR_OMISSAO,
}) => {
  const { tema } = useTheme();

  const animProgresso = useRef(new Animated.Value(progresso)).current;
  const animTopo = useRef(new Animated.Value(topoFrente(progresso, altura))).current;

  // Atualiza animação só quando o progresso muda
  useEffect(() => {
    const pLim = progresso; // já vem limitado do cartão
    Animated.timing(animProgresso, {
      toValue: pLim,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // anima height/top → JS thread
    }).start();

    Animated.timing(animTopo, {
      toValue: topoFrente(pLim, altura),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progresso, altura, animProgresso, animTopo]);

  const estaAImprimirOuPausa =
    estado === 'a-imprimir' || estado === 'em-pausa';
  const estaConcluidaOuRepouso =
    estado === 'concluida' || estado === 'repouso' || estado === 'parada';
  const emPausa = estado === 'em-pausa';

  const corAcento = hexDe(tema.paleta.acento);
  const corMuted = hexDe(tema.paleta.tintaMuted);

  // Halo: gradiente simulado com opacity — RN não suporta linearGradient nativo sem deps.
  // Usamos uma View com backgroundColor rgba e height fixa.
  const haloOpacity = emPausa ? 0.12 : 0.14;
  const haloCor = emPausa ? corMuted : corAcento;

  // Estilo da linha da frente
  const linhaCor = emPausa ? corMuted : corAcento;

  // Segmentos para tracejado (24 segmentos flex:1 com margem)
  const segmentosTracejado = Array.from({ length: 24 }, (_, i) => (
    <View
      key={i}
      style={styles.segmentoTracejado}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  ));

  return (
    <View
      style={[
        styles.frame,
        { height: altura, backgroundColor: hexDe(tema.paleta.fundoBaixo) },
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progresso) }}
      accessibilityLabel={
        estado === 'sem-ligacao'
          ? 'Sem ligação à impressora'
          : `Progresso da impressão ${Math.round(progresso)} por cento`
      }
    >
      {/* 1. Fantasma — o que falta imprimir */}
      {!estaConcluidaOuRepouso && (
        <Image
          source={{ uri }}
          style={[
            styles.img,
            styles.ghost,
            { height: altura, opacity: 0.22 },
          ]}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}

      {/* 2. Camada sólida recortada — o já impresso */}
      {estaAImprimirOuPausa && (
        <Animated.View
          style={[
            styles.clip,
            { height: animProgresso.interpolate({
                inputRange: [0, 100],
                outputRange: [0, altura],
              }) },
          ]}
        >
          <Image
            source={{ uri }}
            style={[styles.img, styles.imgBottom, { height: altura }]}
            resizeMode="contain"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Animated.View>
      )}

      {/* 3. Frente de impressão: linha + halo */}
      {estaAImprimirOuPausa && (
        <Animated.View
          style={[
            styles.front,
            { top: animTopo },
          ]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Linha de 2 dp */}
          <View
            style={[
              styles.line,
              { backgroundColor: linhaCor },
              emPausa && styles.linePaused,
            ]}
          >
            {emPausa && <View style={styles.tracejadoContainer}>{segmentosTracejado}</View>}
          </View>

          {/* Halo de 28 dp (aprox. 30 no mockup) */}
          <View
            style={[
              styles.halo,
              { backgroundColor: `${haloCor}${Math.round(haloOpacity * 255)
                .toString(16)
                .padStart(2, '0')}` },
            ]}
          />
        </Animated.View>
      )}

      {/* Estado final: imagem inteira sem fantasma nem frente */}
      {estaConcluidaOuRepouso && (
        <Image
          source={{ uri }}
          style={[styles.img, { height: altura, opacity: 1 }]}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}

      {/* Sem ligação: só fantasma (já renderizado acima via !estaConcluidaOuRepouso) */}
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
  ghost: {
    // opacity aplicada inline
  },
  clip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  imgBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  front: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  line: {
    height: 2,
  },
  linePaused: {
    backgroundColor: 'transparent',
  },
  tracejadoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  segmentoTracejado: {
    flex: 1,
    height: 2,
    backgroundColor: 'currentColor', // herda do pai via corMuted
    marginHorizontal: 2,
  },
  halo: {
    height: 28,
  },
});