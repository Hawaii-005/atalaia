import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
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

export type MaquinaDoSeletor = {
  id: string;
  nome: string;
  estado: EstadoTrabalho;
};

type Props = {
  maquinas: MaquinaDoSeletor[];
  activaId?: string;
  onEscolher: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Seletor de máquinas do cabeçalho (bloco 1).
 *
 * É o mesmo controlo segmentado de antes, com a cor do estado a vir de
 * `corDoEstado`: um ponto verde quer dizer «a imprimir» em todos os ecrãs.
 */
export const SeletorMaquinas = ({
  maquinas,
  activaId,
  onEscolher,
  style,
}: Props) => {
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          borderRadius: raio.chip,
          backgroundColor: p.cartao,
          borderWidth: 1,
          borderColor: p.contorno,
        },
        style,
      ]}
    >
      {maquinas.map(maquina => {
        const activa = maquina.id === activaId;
        const cores = corDoEstado(p, maquina.estado);
        return (
          <Pressable
            key={maquina.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={maquina.nome}
            onPress={() => onEscolher(maquina.id)}
            style={{
              flex: 1,
              minHeight: tamanho.chip.alturaPequena,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingHorizontal: espaco.sm,
              borderRadius: raio.chip,
              backgroundColor: activa ? p.primaria : 'transparent',
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: activa ? p.textoSobrePrimaria : cores.ponto,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                ...tipos.microForte,
                color: activa ? p.textoSobrePrimaria : p.textoSecundario,
              }}
            >
              {maquina.nome}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
