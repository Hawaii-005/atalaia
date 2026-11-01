import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import {
  espaco,
  fonteNumeros,
  obterPaleta,
  raio,
  texto as tipos,
} from '../../theme/tokensV6';
import { corHex, VistaSlot } from '../../utils/filamentos/vista';
import { formatarGramas } from '../../utils/inicio/formatadores';
import { t, useIdioma } from '../../i18n';

type Props = {
  /** Vistas já construídas por `construirVistaSlots` (trays + bobinas locais). */
  slots: VistaSlot[];
  carregando?: boolean;
  /** Tocar num slot abre a folha desse slot. */
  onSlot?: (trayId: number) => void;
  style?: StyleProp<ViewStyle>;
};

const Cartao = ({
  vista,
  onPress,
}: {
  vista: VistaSlot;
  onPress?: (trayId: number) => void;
}) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  const vazio = vista.estado === 'vazio';
  const quaseNoFim = vista.estado === 'quaseNoFim';
  const cor = vazio ? p.trilha : corHex(vista.cor, p.trilha);
  const material = vista.material || (vazio ? t('filamentos.vazio') : '—');
  const gramas =
    vista.restanteG != null ? formatarGramas(vista.restanteG) : '—';

  return (
    <Pressable
      accessible
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[
        vista.rotulo,
        material,
        gramas,
        vista.emUso ? t('filamentos.emUso') : '',
      ]
        .filter(Boolean)
        .join(', ')}
      style={{
        flex: 1,
        gap: espaco.xs,
        padding: espaco.sm,
        borderRadius: raio.interno,
        backgroundColor: p.cartaoAlt,
        borderWidth: vista.emUso ? 1.5 : 1,
        borderColor: vista.emUso ? p.primaria : p.contorno,
        opacity: vazio ? 0.55 : 1,
      }}
      onPress={onPress ? () => onPress(vista.trayId) : undefined}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            backgroundColor: cor,
            borderWidth: 1,
            borderColor: p.contorno,
          }}
        />
        <Text
          style={{
            ...tipos.micro,
            color: p.textoSecundario,
            fontFamily: fonteNumeros,
          }}
        >
          {vista.rotulo}
        </Text>
      </View>

      <Text numberOfLines={1} style={{ ...tipos.microForte, color: p.texto }}>
        {material}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          ...tipos.micro,
          fontFamily: fonteNumeros,
          color: quaseNoFim ? p.aviso : p.textoSecundario,
        }}
      >
        {gramas}
      </Text>
    </Pressable>
  );
};

/**
 * Slots do CANVAS no Início (bloco 8).
 *
 * A impressora nunca diz quantas gramas restam — só a bobina associada no
 * inventário local sabe isso. Sem bobina, o cartão mostra material e «—» em vez
 * de inventar um número.
 */
export const SlotsCanvas = ({ slots, carregando, onSlot, style }: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  if (carregando) {
    return (
      <View style={[{ flexDirection: 'row', gap: espaco.sm }, style]}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 62,
              borderRadius: raio.interno,
              backgroundColor: p.cartaoAlt,
              opacity: 0.5,
            }}
          />
        ))}
      </View>
    );
  }

  if (slots.length === 0) {
    return (
      <View style={style}>
        <Text style={{ ...tipos.micro, color: p.textoSecundario }}>
          {t('inicio.slotsVazios')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[{ flexDirection: 'row', gap: espaco.sm }, style]}>
      {slots.map(vista => (
        <Cartao key={vista.trayId} vista={vista} onPress={onSlot} />
      ))}
    </View>
  );
};
