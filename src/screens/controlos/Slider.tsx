import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, ViewProps } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { valorDoToque } from '../../utils/controlos/deslizante';

type Props = {
  /** 0 a 100. */
  valor: number;
  etiqueta: string;
  desactivado?: boolean;
  /** Chamado durante o arrasto, só para mostrar o número. */
  onChange: (valor: number) => void;
  /** Chamado ao soltar — é aqui que se envia o comando. */
  onCommit: (valor: number) => void;
};

/** Slider de 0 a 100 sem dependências: PanResponder nativo. */
export const Slider = ({
  valor,
  etiqueta,
  desactivado,
  onChange,
  onCommit,
}: Props) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const [largura, setLargura] = useState(0);
  const [local, setLocal] = useState(valor);

  useEffect(() => {
    setLocal(valor);
  }, [valor]);

  const dados = useRef({ largura, local, desactivado, onChange, onCommit });
  dados.current = { largura, local, desactivado, onChange, onCommit };

  const paraValor = (x: number): number => {
    const { largura: w } = dados.current;
    if (w <= 0) return dados.current.local;
    return valorDoToque(x, w);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !dados.current.desactivado,
      onMoveShouldSetPanResponder: () => !dados.current.desactivado,
      onPanResponderGrant: e => {
        const v = paraValor(e.nativeEvent.locationX);
        setLocal(v);
        dados.current.onChange(v);
      },
      onPanResponderMove: e => {
        const v = paraValor(e.nativeEvent.locationX);
        setLocal(v);
        dados.current.onChange(v);
      },
      onPanResponderRelease: () => {
        dados.current.onCommit(dados.current.local);
      },
      onPanResponderTerminate: () => {
        dados.current.onCommit(dados.current.local);
      },
    })
  ).current;

  const ajustar = (delta: number) => {
    const v = Math.max(0, Math.min(100, dados.current.local + delta));
    setLocal(v);
    onChange(v);
    onCommit(v);
  };

  return (
    <View
      onLayout={e => setLargura(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: 100, now: local }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => {
        if (desactivado) return;
        ajustar(e.nativeEvent.actionName === 'increment' ? 10 : -10);
      }}
      style={{ opacity: desactivado ? 0.4 : 1 }}
      {...responder.panHandlers}
    >
      <AlturaSimples>
        <View style={[estilos.trilho, { backgroundColor: hexDe(p.linha) }]}>
          <View
            style={[
              estilos.preenchido,
              { width: `${local}%`, backgroundColor: hexDe(p.acento) },
            ]}
          />
        </View>
        <View style={{ width: 44, alignItems: 'flex-end' }}>
          <Text
            style={{ fontSize: 12, fontWeight: '700', color: hexDe(p.tinta) }}
          >
            {Math.round(local)}%
          </Text>
        </View>
      </AlturaSimples>
    </View>
  );
};

/** Wrapper sem estilo, para o layout ficar com o cartão. */
const AlturaSimples: React.FC<ViewProps> = ({ children, ...resto }) => (
  <View
    {...resto}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
    }}
  >
    {children}
  </View>
);

const estilos = StyleSheet.create({
  trilho: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  preenchido: { height: 6, borderRadius: 3 },
});
