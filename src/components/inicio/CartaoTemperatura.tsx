import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import {
  espaco,
  fonteNumeros,
  obterPaleta,
  raio,
  texto as tipos,
} from '../../theme/tokensV6';
import { formatarTemperatura } from '../../utils/inicio/formatadores';

type Props = {
  rotulo: string;
  valor?: number | null;
  /** Temperatura pedida pela máquina; 0 ou ausente esconde a segunda linha. */
  alvo?: number | null;
  /** Cor do número (bico, mesa, câmara). */
  cor: string;
  /** Mostra a linha do alvo ao lado do valor, em vez de por baixo. */
  alvoEmLinha?: boolean;
  desactivado?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cartão de temperatura do Início. Um valor, o alvo quando existe, e a cor do
 * sensor — sem barras nem gráficos: o que interessa é ler o número de longe.
 */
export const CartaoTemperatura = ({
  rotulo,
  valor,
  alvo,
  cor,
  alvoEmLinha,
  desactivado,
  style,
}: Props) => {
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);
  const formatado = formatarTemperatura(valor, alvo);

  return (
    <View
      accessible
      accessibilityLabel={[rotulo, formatado.valor, formatado.alvo]
        .filter(Boolean)
        .join(' ')}
      style={[
        {
          flex: 1,
          backgroundColor: p.cartao,
          borderRadius: raio.interno,
          paddingVertical: espaco.md,
          paddingHorizontal: espaco.md,
          opacity: desactivado ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ ...tipos.micro, color: p.textoSecundario }}
      >
        {rotulo}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: espaco.xs,
          marginTop: espaco.xs,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...tipos.valorTemperatura,
            color: cor,
            fontFamily: fonteNumeros,
          }}
        >
          {formatado.valor}
        </Text>
        {formatado.alvo && alvoEmLinha ? (
          <Text
            style={{
              ...tipos.micro,
              color: p.textoSecundario,
              fontFamily: fonteNumeros,
              marginBottom: 3,
            }}
          >
            {formatado.alvo}
          </Text>
        ) : null}
      </View>

      {formatado.alvo && !alvoEmLinha ? (
        <Text
          numberOfLines={1}
          style={{
            ...tipos.micro,
            color: p.textoSecundario,
            fontFamily: fonteNumeros,
          }}
        >
          {formatado.alvo}
        </Text>
      ) : null}
    </View>
  );
};
