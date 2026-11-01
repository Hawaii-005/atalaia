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
  obterPaleta,
  raio,
  tamanho,
  texto as tipos,
} from '../../theme/tokensV6';
import { formatTimeAgo } from '../../utils/FormatUtils';
import { EstadoTrabalho } from '../../utils/inicio/formatadores';
import { t, useIdioma } from '../../i18n';
import { PilulaEstado } from './PilulaEstado';

type Props = {
  nome: string;
  estado: EstadoTrabalho;
  /** Endereço que a app usa para falar com a máquina. */
  ip?: string;
  /** Última leitura, em ms. Sem ela não se mostra a hora. */
  atualizadoEm?: number | null;
  /** Texto no lugar do estado (ex.: «Pronta para imprimir»). */
  textoEstado?: string;
  /** Seletor de máquinas ou outro conteúdo à direita do nome. */
  extra?: React.ReactNode;
  onAdicionar?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cabeçalho do Início (bloco 1): quem é a máquina, em que estado está e quão
 * fresca é a leitura. A hora é o que distingue «pronta» de «pronta há 10 min».
 */
export const CabecalhoImpressora = ({
  nome,
  estado,
  ip,
  atualizadoEm,
  textoEstado,
  extra,
  onAdicionar,
  style,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  const quando =
    atualizadoEm && atualizadoEm > 0
      ? formatTimeAgo(atualizadoEm, Date.now())
      : null;
  const legenda = [ip, quando].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: espaco.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: espaco.xs }}>
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={{ ...tipos.tituloCartao, color: p.texto }}
        >
          {nome}
        </Text>

        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.sm }}
        >
          <PilulaEstado estado={estado} texto={textoEstado} compacta />
          {legenda ? (
            <Text
              numberOfLines={1}
              style={{ ...tipos.micro, color: p.textoSecundario }}
            >
              {legenda}
            </Text>
          ) : null}
        </View>
      </View>

      {extra}

      {onAdicionar ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('home.adicionarImpressora')}
          onPress={onAdicionar}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: tamanho.botaoCirculo,
            height: tamanho.botaoCirculo,
            borderRadius: raio.chip,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.cartaoAlt,
          }}
        >
          <Ionicons name="add" size={22} color={p.texto} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
