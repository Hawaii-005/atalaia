import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ItemFila } from '../../utils/fila/modelo';

type Props = {
  itens: ItemFila[];
  /** Altura fixa de cada cartão — o arrastar calcula as posições com ela. */
  altura: number;
  espaco?: number;
  podeArrastar: (item: ItemFila) => boolean;
  onMover: (id: string, destino: number) => void;
  children: (item: ItemFila, indice: number) => React.ReactNode;
};

type LinhaProps = {
  children: React.ReactNode;
  indice: number;
  total: number;
  altura: number;
  espaco: number;
  activo: boolean;
  onSoltar: (indice: number, passos: number) => void;
};

const Linha = ({
  children,
  indice,
  total,
  altura,
  espaco,
  activo,
  onSoltar,
}: LinhaProps) => {
  const [aArrastar, setAArrastar] = useState(false);
  const deslocamento = useSharedValue(0);

  const soltar = (passos: number) => {
    setAArrastar(false);
    onSoltar(indice, passos);
  };

  const pan = Gesture.Pan()
    .enabled(activo)
    .activateAfterLongPress(260)
    .onBegin(() => {
      runOnJS(setAArrastar)(true);
    })
    .onUpdate(evento => {
      deslocamento.value = evento.translationY;
    })
    .onEnd(evento => {
      const passos = Math.round(evento.translationY / (altura + espaco));
      deslocamento.value = withTiming(0, { duration: 140 });
      runOnJS(soltar)(passos);
    })
    .onFinalize(() => {
      deslocamento.value = withTiming(0, { duration: 140 });
    });

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { translateY: deslocamento.value },
      { scale: aArrastar ? 1.02 : 1 },
    ],
    zIndex: aArrastar ? 20 : 0,
    opacity: aArrastar ? 0.96 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ marginBottom: espaco }, estilo]}
        accessibilityActions={
          activo
            ? [
                { name: 'moveUp', label: 'Subir' },
                { name: 'moveDown', label: 'Descer' },
              ]
            : undefined
        }
        onAccessibilityAction={evento => {
          if (evento.nativeEvent.actionName === 'moveUp') {
            onSoltar(indice, -1);
          }
          if (evento.nativeEvent.actionName === 'moveDown') {
            onSoltar(indice, 1);
          }
        }}
      >
        {children}
        {aArrastar ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill} />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
};

/**
 * Lista com arrastar-para-reordenar. O movimento só começa com um toque longo,
 * para não competir com o toque normal (abrir o detalhe) nem com o scroll.
 */
export const ListaArrastavel = ({
  itens,
  altura,
  espaco = 10,
  podeArrastar,
  onMover,
  children,
}: Props) => {
  const soltar = (indice: number, passos: number) => {
    if (!passos) return;
    const item = itens[indice];
    if (!item) return;
    const destino = Math.max(0, Math.min(itens.length - 1, indice + passos));
    if (destino === indice) return;
    onMover(item.id, destino);
  };

  return (
    <View>
      {itens.map((item, indice) => (
        <Linha
          key={item.id}
          indice={indice}
          total={itens.length}
          altura={altura}
          espaco={espaco}
          activo={podeArrastar(item)}
          onSoltar={soltar}
        >
          {children(item, indice)}
        </Linha>
      ))}
    </View>
  );
};
