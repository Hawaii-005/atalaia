import React from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  espaco,
  fonteNumeros,
  obterPaleta,
  raio,
  texto as tipos,
} from '../../theme/tokensV6';
import { formatDuration, PrintRecord } from '../../utils/printHistory';
import { nomeDoFicheiro } from '../../utils/inicio/formatadores';
import { t, useIdioma } from '../../i18n';

type Props = {
  registos: PrintRecord[];
  onVerTudo?: () => void;
  /** Máximo de linhas; o tablet mostra mais. */
  limite?: number;
  style?: StyleProp<ViewStyle>;
};

/** Bloco 5: os últimos trabalhos desta máquina. */
export const ListaHistorico = ({
  registos,
  onVerTudo,
  limite = 4,
  style,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);
  const visiveis = registos.slice(0, limite);

  return (
    <View
      style={[
        {
          borderRadius: raio.cartao,
          backgroundColor: p.cartao,
          borderWidth: 1,
          borderColor: p.contorno,
          paddingHorizontal: espaco.md,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: espaco.sm,
        }}
      >
        <Text style={{ flex: 1, ...tipos.legendaForte, color: p.texto }}>
          {t('inicio.historico')}
        </Text>
        {onVerTudo ? (
          <TouchableOpacity
            onPress={onVerTudo}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ ...tipos.microForte, color: p.primaria }}>
              {t('inicio.verTudo')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {visiveis.length === 0 ? (
        <Text
          style={{
            ...tipos.micro,
            color: p.textoSecundario,
            paddingVertical: espaco.md,
            textAlign: 'center',
          }}
        >
          {t('inicio.semHistorico')}
        </Text>
      ) : (
        visiveis.map((registo, indice) => {
          const falhou = registo.outcome === 'stopped';
          return (
            <View
              key={registo.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: espaco.sm,
                paddingVertical: espaco.sm,
                borderTopWidth: indice === 0 ? 0 : 1,
                borderTopColor: p.contorno,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: p.cartaoAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={falhou ? 'close' : 'checkmark'}
                  size={14}
                  color={falhou ? p.perigo : p.sucesso}
                />
              </View>
              <Text
                numberOfLines={1}
                style={{ flex: 1, ...tipos.microForte, color: p.texto }}
              >
                {nomeDoFicheiro(registo.filename) || registo.filename}
              </Text>
              <Text
                style={{
                  ...tipos.micro,
                  color: p.textoSecundario,
                  fontFamily: fonteNumeros,
                }}
              >
                {formatDuration(registo)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
};
