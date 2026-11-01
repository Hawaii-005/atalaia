import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import {
  anel as tamanhos,
  fonteNumeros,
  obterPaleta,
  texto as tipos,
  tracoDoAnel,
} from '../../theme/tokensV6';

type Tamanho = keyof typeof tamanhos;

type Props = {
  /** 0..100. Valores fora do intervalo são limitados. */
  progresso: number;
  tamanho?: Tamanho;
  /** Cor do arco; por omissão a cor primária do tema. */
  cor?: string;
  /** Cor do anel vazio; por omissão a trilha do tema. */
  trilho?: string;
  /** Linha por baixo da percentagem («1h12m»). */
  legenda?: string | null;
  /** Conteúdo no centro. Sem ele, mostra a percentagem. */
  children?: React.ReactNode;
  /** Substitui a percentagem por outra coisa (ex.: «a preparar»). */
  ocultarPercentagem?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Anel de progresso do Início.
 *
 * Existia dentro do ecrã da Impressora, com a miniatura do ficheiro no meio.
 * Aqui é o mesmo desenho, isolado: o Início usa-o no bloco 6 e a Impressora
 * passa a poder usá-lo também, para não haver dois anéis a divergir.
 */
export const AnelProgresso = ({
  progresso,
  tamanho = 'grande',
  cor,
  trilho,
  legenda,
  children,
  ocultarPercentagem,
  style,
  accessibilityLabel,
}: Props) => {
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  const { caixa, raio, traco } = tamanhos[tamanho];
  const centro = caixa / 2;
  const [preenchido, perimetro] = tracoDoAnel(
    raio,
    Number.isFinite(progresso) ? progresso : 0
  );

  const corDoArco = cor ?? p.primaria;
  const corDoTrilho = trilho ?? p.trilha;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(Math.max(0, Math.min(100, progresso))),
      }}
      style={[
        {
          width: caixa,
          height: caixa,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Svg width={caixa} height={caixa} style={{ position: 'absolute' }}>
        <Circle
          cx={centro}
          cy={centro}
          r={raio}
          stroke={corDoTrilho}
          strokeWidth={traco}
          fill="none"
        />
        <Circle
          cx={centro}
          cy={centro}
          r={raio}
          stroke={corDoArco}
          strokeWidth={traco}
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${perimetro}`}
          fill="none"
          transform={`rotate(-90 ${centro} ${centro})`}
        />
      </Svg>

      {children ??
        (!ocultarPercentagem && (
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                ...tipos.percentagemAnel,
                color: p.texto,
                fontFamily: fonteNumeros,
              }}
            >
              {`${Math.round(Math.max(0, Math.min(100, progresso)))}%`}
            </Text>
            {legenda ? (
              <Text
                numberOfLines={1}
                style={{
                  ...tipos.micro,
                  color: p.textoSecundario,
                  fontFamily: fonteNumeros,
                  marginTop: 2,
                }}
              >
                {legenda}
              </Text>
            ) : null}
          </View>
        ))}
    </View>
  );
};
