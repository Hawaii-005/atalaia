import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Mascote, PoseMascote } from './Mascote';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { espaco, raio } from '../theme/tokensV6';

interface Acao {
  rotulo: string;
  aoTocar: () => void;
}

interface Props {
  pose: PoseMascote;
  titulo: string;
  descricao?: string;
  acaoPrimaria?: Acao;
  acaoSecundaria?: Acao;
}

/**
 * Estado vazio com a mascote: só para quando a app precisa de falar com o
 * utilizador (sem impressoras, sem ligação, à espera, terminado). Nunca em
 * ecrãs de dados ou de controlo.
 */
export const EstadoVazio = ({
  pose,
  titulo,
  descricao,
  acaoPrimaria,
  acaoSecundaria,
}: Props) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: espaco.xl,
        paddingVertical: espaco.lg,
        gap: espaco.sm,
      }}
    >
      <Mascote pose={pose} tamanho={160} />
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          color: hexDe(paleta.tinta),
          textAlign: 'center',
          marginTop: espaco.sm,
        }}
      >
        {titulo}
      </Text>
      {descricao ? (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: hexDe(paleta.tintaSoft),
            textAlign: 'center',
          }}
        >
          {descricao}
        </Text>
      ) : null}

      {acaoPrimaria ? (
        <TouchableOpacity
          onPress={acaoPrimaria.aoTocar}
          accessibilityRole="button"
          activeOpacity={0.8}
          style={{
            alignSelf: 'stretch',
            minHeight: 48,
            borderRadius: raio.botao,
            backgroundColor: hexDe(paleta.acento),
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: espaco.md,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {acaoPrimaria.rotulo}
          </Text>
        </TouchableOpacity>
      ) : null}

      {acaoSecundaria ? (
        <TouchableOpacity
          onPress={acaoSecundaria.aoTocar}
          accessibilityRole="button"
          activeOpacity={0.8}
          style={{
            alignSelf: 'stretch',
            minHeight: 48,
            borderRadius: raio.botao,
            borderWidth: 1.5,
            borderColor: hexDe(paleta.linha),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: hexDe(paleta.tinta) }}>
            {acaoSecundaria.rotulo}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
