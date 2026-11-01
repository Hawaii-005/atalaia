import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import { segundosRestantes } from '../../utils/fila/modos';

type Props = {
  /** Epoch em ms em que a contagem acaba. */
  fim: number;
  /** Segundos com que a contagem começou (para a barra). */
  duracaoSeg: number;
  /** Chamado uma única vez, quando chega a zero. */
  onExpirar: () => void;
};

/**
 * Contagem decrescente do «Mesa limpa?».
 *
 * Ao chegar a zero **não arranca nada**: o pedido desaparece e o trabalho fica
 * pendente, como manda a regra da fase 0.
 */
export const Contagem = ({ fim, duracaoSeg, onExpirar }: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const [restam, setRestam] = useState(() =>
    segundosRestantes(fim, Date.now())
  );
  const expirouRef = useRef(false);

  useEffect(() => {
    expirouRef.current = false;
    const id = setInterval(() => {
      const valor = segundosRestantes(fim, Date.now());
      setRestam(valor);
      if (valor === 0 && !expirouRef.current) {
        expirouRef.current = true;
        clearInterval(id);
        onExpirar();
      }
    }, 250);
    return () => clearInterval(id);
  }, [fim, onExpirar]);

  const fracao = Math.max(0, Math.min(1, restam / Math.max(1, duracaoSeg)));
  const cor = restam <= 5 ? p.perigo : p.aviso;

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{ fontSize: 13, fontWeight: '800', color: hexDe(p.tinta) }}
        accessibilityLiveRegion="polite"
      >
        {t('fila.contagemRestante', { s: restam })}
      </Text>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: hexDe(p.linha),
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(fracao * 100)}%`,
            height: '100%',
            backgroundColor: hexDe(cor),
          }}
        />
      </View>
    </View>
  );
};
