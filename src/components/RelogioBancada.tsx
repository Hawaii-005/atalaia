import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Line, Text, G } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import {
  TrabalhoRelogio,
  pontoHora,
  arcoSvg,
} from '../utils/relogio';

export interface RelogioBancadaProps {
  agora: Date;
  trabalhos: TrabalhoRelogio[];
  tamanho?: number;
  aoTocar?: (id: string) => void;
}

/**
 * Relógio de 24 horas que mostra trabalhos como arcos coloridos.
 * 0 h no topo, sentido horário, com anel de noite (0-6 h e 20-24 h).
 */
export function RelogioBancada({
  agora,
  trabalhos,
  tamanho = 340,
  aoTocar,
}: RelogioBancadaProps) {
  const { tema } = useTheme();
  const paleta = tema.paleta;

  const centro = tamanho / 2;
  const raioExterno = tamanho * 0.48;
  const raioTracos = tamanho * 0.44;
  const raioRotulos = tamanho * 0.38;
  const raioPonteiro = tamanho * 0.44;

  // hora decimal actual
  const horaAgora =
    agora.getHours() + agora.getMinutes() / 60 + agora.getSeconds() / 3600;

  // renderizar traços de hora (24 traços)
  const tracos = Array.from({ length: 24 }, (_, i) => {
    const [x1, y1] = pontoHora(i, raioExterno, centro, centro);
    const [x2, y2] = pontoHora(i, raioTracos, centro, centro);
    const espessura = i % 6 === 0 ? 2 : 1;
    const cor = hexDe(paleta.linha);

    return (
      <Line
        key={`traco-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={cor}
        strokeWidth={espessura}
      />
    );
  });

  // renderizar rótulos de 3 em 3 horas
  const rotulos = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
    const [x, y] = pontoHora(h, raioRotulos, centro, centro);
    const texto = h.toString().padStart(2, '0');
    const cor = hexDe(paleta.tintaMuted);

    return (
      <Text
        key={`rotulo-${h}`}
        x={x}
        y={y}
        fontSize={12}
        fill={cor}
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {texto}
      </Text>
    );
  });

  // anel de noite: 0-6 h e 20-24 h
  const corNoite = hexDe(paleta.linha);
  const raioNoite = raioExterno;
  const arcoNoite1 = arcoSvg(0, 6, raioNoite, centro, centro);
  const arcoNoite2 = arcoSvg(20, 24, raioNoite, centro, centro);

  // renderizar trabalhos como arcos
  const elementosTrabalhos = trabalhos.map((trabalho, indice) => {
    const raioArco = tamanho * (0.36 - indice * 0.05);
    const path = arcoSvg(
      trabalho.inicio,
      trabalho.fim,
      raioArco,
      centro,
      centro
    );

    if (!path) return null;

    // ponto no fim do arco para o círculo e rótulo
    const [xFim, yFim] = pontoHora(trabalho.fim, raioArco, centro, centro);

    // rótulo junto ao fim
    const corTexto = hexDe(paleta.tintaSoft);

    return (
      <G
        key={trabalho.id}
        onPress={() => aoTocar?.(trabalho.id)}
      >
        <Path
          d={path}
          stroke={trabalho.cor}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={xFim} cy={yFim} r={4} fill={trabalho.cor} />
        <Text
          x={xFim}
          y={yFim - 12}
          fontSize={11}
          fill={corTexto}
          textAnchor="middle"
        >
          {trabalho.nome}
        </Text>
      </G>
    );
  });

  // ponteiro de agora
  const corPonteiro = hexDe(paleta.tinta);
  const [xPonteiro, yPonteiro] = pontoHora(
    horaAgora,
    raioPonteiro,
    centro,
    centro
  );

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Svg width={tamanho} height={tamanho}>
        {/* círculo exterior */}
        <Circle
          cx={centro}
          cy={centro}
          r={raioExterno}
          stroke={hexDe(paleta.linha)}
          strokeWidth={1}
          fill="none"
        />

        {/* anéis de noite */}
        {arcoNoite1 && (
          <Path
            d={arcoNoite1}
            stroke={corNoite}
            strokeWidth={8}
            strokeOpacity={0.55}
            fill="none"
          />
        )}
        {arcoNoite2 && (
          <Path
            d={arcoNoite2}
            stroke={corNoite}
            strokeWidth={8}
            strokeOpacity={0.55}
            fill="none"
          />
        )}

        {/* traços de hora */}
        {tracos}

        {/* rótulos */}
        {rotulos}

        {/* trabalhos */}
        {elementosTrabalhos}

        {/* ponteiro de agora */}
        <Line
          x1={centro}
          y1={centro}
          x2={xPonteiro}
          y2={yPonteiro}
          stroke={corPonteiro}
          strokeWidth={2}
        />
        <Circle cx={centro} cy={centro} r={3} fill={corPonteiro} />
      </Svg>
    </View>
  );
}
