import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import {
  corDoEstado,
  espaco,
  obterPaleta,
  raio,
  tamanho,
  texto as tipos,
} from '../../theme/tokensV6';
import { EstadoTrabalho } from '../../utils/inicio/formatadores';
import { t, useIdioma } from '../../i18n';

/** Chave de tradução de cada estado. Uma pílula, um texto. */
const CHAVE: Record<EstadoTrabalho, string> = {
  semLigacao: 'inicio.semLigacao',
  pronta: 'inicio.pronta',
  preparando: 'estado.aPreparar',
  imprimindo: 'estado.imprimindo',
  pausada: 'estado.emPausa',
  terminada: 'estado.terminada',
  parada: 'estado.parada',
  erro: 'estado.erro',
};

export const rotuloDoEstado = (estado: EstadoTrabalho): string =>
  t(CHAVE[estado]);

type Props = {
  estado: EstadoTrabalho;
  /** Substitui o texto traduzido (ex.: «Pronta para imprimir» na resina). */
  texto?: string;
  /** Ponto colorido antes do texto. */
  comPonto?: boolean;
  compacta?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pílula de estado da impressora.
 *
 * A cor vem de `corDoEstado`, para o Início, a Impressora e a lista de máquinas
 * não inventarem cada um o seu verde.
 */
export const PilulaEstado = ({
  estado,
  texto,
  comPonto = true,
  compacta,
  style,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);
  const cores = corDoEstado(p, estado);
  const altura = compacta ? 22 : tamanho.pilulaEstado.altura;

  return (
    <View
      accessible
      accessibilityLabel={texto ?? rotuloDoEstado(estado)}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          height: altura,
          paddingHorizontal: compacta ? espaco.sm : espaco.md,
          borderRadius: raio.chip,
          backgroundColor: cores.fundo,
        },
        style,
      ]}
    >
      {comPonto ? (
        <View
          style={{
            width: compacta ? 6 : 8,
            height: compacta ? 6 : 8,
            borderRadius: 4,
            backgroundColor: cores.ponto,
          }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          ...(compacta ? tipos.microForte : tipos.legendaForte),
          color: cores.texto,
        }}
      >
        {texto ?? rotuloDoEstado(estado)}
      </Text>
    </View>
  );
};
