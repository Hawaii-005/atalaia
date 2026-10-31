import React from 'react';
import Svg, { Ellipse, Line } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import {
  TipoEstrato,
  CAMADAS_DESENHADAS,
  camadasPostas,
  meiaLargura,
} from '../utils/perfilEstratos';

export interface EstratosProps {
  actual: number; // camada actual (0 sem trabalho)
  total: number; // total de camadas (0 se desconhecido)
  progresso: number; // 0..100
  tipo: TipoEstrato;
  altura?: number; // dp, por omissão 360
  /** descrição para leitores de ecrã */
  rotulo?: string;
}

/**
 * Componente visual de estratos (camadas), representando o perfil de impressão.
 * Puramente decorativo, sem estados nem interação.
 */
export function Estratos(props: EstratosProps): React.JSX.Element {
  const { actual, total, progresso, tipo, altura = 360, rotulo } = props;
  const { tema } = useTheme();

  const corAcento = hexDe(tema.paleta.acento);
  const corLinha = hexDe(tema.paleta.linha);
  const corTinta = hexDe(tema.paleta.tinta);
  const corTintaSoft = hexDe(tema.paleta.tintaSoft);

  const n = CAMADAS_DESENHADAS;
  const postas = camadasPostas(actual, total, progresso, n);

  // Espaçamento vertical: do fundo (altura) para o topo (0)
  const passo = altura / n;

  // Calculamos e desenhamos cada camada, de i=0 (fundo) até i=n-1 (topo)
  const camadas = Array.from({ length: n }).map((_, i) => {
    const rx = meiaLargura(i, n, tipo);
    const ry = rx * 0.22;
    const cy = altura - i * passo - passo / 2;

    let estadoCamada: 'posta' | 'actual' | 'futura' = 'futura';
    if (i < postas) {
      estadoCamada = 'posta';
    } else if (i === postas) {
      // Se não há trabalho, não marcamos nenhuma camada como actual (todas futuras)
      if (actual === 0 && progresso === 0) {
        estadoCamada = 'futura';
      } else {
        estadoCamada = 'actual';
      }
    }

    if (estadoCamada === 'posta') {
      return (
        <Ellipse
          key={i}
          cx={180}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={corAcento}
          strokeWidth={3}
          strokeOpacity={0.92}
        />
      );
    }

    if (estadoCamada === 'actual') {
      return (
        <Ellipse
          key={i}
          cx={180}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={corAcento}
          fillOpacity={0.14}
          stroke={corAcento}
          strokeWidth={5}
        />
      );
    }

    // Futura
    return (
      <Ellipse
        key={i}
        cx={180}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={corTintaSoft}
        strokeWidth={2.4}
        strokeDasharray="4 5"
      />
    );
  });

  return (
    <Svg
      viewBox={`0 0 360 ${altura}`}
      preserveAspectRatio="xMidYMax meet"
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        rotulo ??
        `Camadas: ${Math.round(Math.max(0, Math.min(100, progresso)))}% impresso`
      }
    >
      <Line
        x1={0}
        y1={altura}
        x2={360}
        y2={altura}
        stroke={corTinta}
        strokeOpacity={0.25}
        strokeWidth={1}
      />
      {camadas}
    </Svg>
  );
}
