import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';

type Props = {
  pausada: boolean;
  ligada: boolean;
};

/**
 * Diz sempre a mesma verdade: a fila só arranca com a app aberta. Quando está
 * pausada (ou sem ligação) o motivo aparece em vez de um botão morto.
 */
export const FaixaArranque = ({ pausada, ligada }: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const cor = pausada || !ligada ? p.aviso : p.acentoTexto;
  const texto = !ligada
    ? t('fila.aberta')
    : pausada
      ? t('fila.pausada')
      : t('fila.aberta');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: hexDe(cor) + '55',
        backgroundColor: hexDe(cor) + '12',
      }}
    >
      <Ionicons
        name={
          pausada || !ligada
            ? 'pause-circle-outline'
            : 'information-circle-outline'
        }
        size={17}
        color={hexDe(cor)}
      />
      <Text style={{ flex: 1, fontSize: 12, color: hexDe(p.tinta) }}>
        {texto}
      </Text>
    </View>
  );
};
