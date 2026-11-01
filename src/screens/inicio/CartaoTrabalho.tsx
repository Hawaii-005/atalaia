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
import { formatarCamadas } from '../../utils/inicio/formatadores';
import { t, useIdioma } from '../../i18n';

type Props = {
  nome?: string;
  camadaAtual?: number | null;
  camadaTotal?: number | null;
  percentagem: number;
  restante?: string | null;
  /** Cores lidas do G-code; null quando ainda não se sabe. */
  cores?: number | null;
  /** Resina não tem camadas iguais nem cores: mostra só o nome. */
  resina?: boolean;
  onEscolher?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Bloco 3 do Início: o trabalho em curso, em texto.
 *
 * Não repete a percentagem em grande (isso é o anel, bloco 6): aqui interessa
 * saber que ficheiro é, em que camada vai e quantas cores tem.
 */
export const CartaoTrabalho = ({
  nome,
  camadaAtual,
  camadaTotal,
  percentagem,
  restante,
  cores,
  resina,
  onEscolher,
  style,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  const camadas = formatarCamadas(camadaAtual, camadaTotal);
  const meta = [camadas ? `${t('detalhes.camada')} ${camadas}` : null, restante]
    .filter(Boolean)
    .join(' · ');
  const progresso = Math.max(0, Math.min(100, percentagem));

  return (
    <View
      style={[
        {
          gap: espaco.sm,
          padding: espaco.md,
          borderRadius: raio.cartao,
          backgroundColor: p.cartao,
          borderWidth: 1,
          borderColor: p.contorno,
        },
        style,
      ]}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{ ...tipos.tituloCartao, fontSize: 15, color: p.texto }}
          >
            {nome || t('bancada.semTrabalho')}
          </Text>
          {meta ? (
            <Text
              numberOfLines={1}
              style={{
                ...tipos.micro,
                color: p.textoSecundario,
                fontFamily: fonteNumeros,
              }}
            >
              {meta}
            </Text>
          ) : null}
        </View>

        {cores != null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: espaco.sm,
              height: 24,
              borderRadius: raio.chip,
              backgroundColor: p.cartaoAlt,
            }}
          >
            <Ionicons
              name="color-palette-outline"
              size={13}
              color={p.textoSecundario}
            />
            <Text style={{ ...tipos.micro, color: p.textoSecundario }}>
              {t('inicio.coresGcode', { n: cores })}
            </Text>
          </View>
        ) : null}
      </View>

      {!resina && progresso > 0 ? (
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: p.trilha,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progresso}%`,
              height: 4,
              borderRadius: 2,
              backgroundColor: p.primaria,
            }}
          />
        </View>
      ) : null}

      {!nome && onEscolher ? (
        <TouchableOpacity
          onPress={onEscolher}
          accessibilityRole="button"
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: espaco.md,
            height: 34,
            borderRadius: raio.chip,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.cartaoAlt,
          }}
        >
          <Text style={{ ...tipos.microForte, color: p.primaria }}>
            {t('camera.escolherFicheiro')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
