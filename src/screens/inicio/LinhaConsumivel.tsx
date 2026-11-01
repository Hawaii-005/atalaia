import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  espaco,
  fonteNumeros,
  obterPaleta,
  raio,
  texto as tipos,
} from '../../theme/tokensV6';

type Props = {
  nome: string;
  detalhe: string;
  cor?: string;
  icone: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Bloco 11: a bobina ou a garrafa que está na máquina, numa linha. */
export const LinhaConsumivel = ({
  nome,
  detalhe,
  cor,
  icone,
  onPress,
  style,
}: Props) => {
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${nome}. ${detalhe}`}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: espaco.md,
          paddingVertical: espaco.sm,
          paddingHorizontal: espaco.md,
          borderRadius: raio.cartao,
          backgroundColor: p.cartao,
          borderWidth: 1,
          borderColor: p.contorno,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: cor ?? p.cartaoAlt,
          borderWidth: 1,
          borderColor: p.contorno,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icone} size={14} color={p.texto} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ ...tipos.legendaForte, color: p.texto }}
        >
          {nome}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            ...tipos.micro,
            color: p.textoSecundario,
            fontFamily: fonteNumeros,
          }}
        >
          {detalhe}
        </Text>
      </View>

      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={p.textoSecundario} />
      ) : null}
    </Pressable>
  );
};
