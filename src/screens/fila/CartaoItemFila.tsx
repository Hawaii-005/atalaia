import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { ItemFila } from '../../utils/fila/modelo';
import { EstimativaItem } from '../../utils/fila/estimativas';
import { t, useIdioma } from '../../i18n';
import { LinhaTempo, PilulaEstado } from './estado';
import { Miniatura } from './Miniatura';

type Props = {
  item: ItemFila;
  posicao: number;
  estimativa?: EstimativaItem;
  altura: number;
  selecionado?: boolean;
  onAbrir: () => void;
  onSubir: () => void;
  onDescer: () => void;
  podeSubir: boolean;
  podeDescer: boolean;
};

/** Cartão de um trabalho na fila: posição, estado, tempo e atalhos ↑↓. */
export const CartaoItemFila = ({
  item,
  posicao,
  estimativa,
  altura,
  selecionado,
  onAbrir,
  onSubir,
  onDescer,
  podeSubir,
  podeDescer,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const bloqueado = item.estado === 'bloqueado' || item.estado === 'falhou';
  const borda = selecionado
    ? hexDe(p.acentoTexto)
    : bloqueado
      ? hexDe(p.aviso) + '99'
      : hexDe(p.linha);

  return (
    <TouchableOpacity
      onPress={onAbrir}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${posicao}. ${item.label || item.name}`}
      accessibilityHint={t('fila.detalhe')}
      style={{
        height: altura,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        borderRadius: 18,
        borderWidth: selecionado ? 2 : 1.5,
        borderColor: borda,
        backgroundColor: hexDe(p.cartao),
      }}
    >
      <Ionicons
        name="reorder-two-outline"
        size={16}
        color={hexDe(p.tintaSoft) + '99'}
      />

      <View style={{ width: 46, height: 46 }}>
        <Miniatura nome={item.miniatura} tamanho={46} />
        <View
          style={{
            position: 'absolute',
            left: -5,
            top: -5,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 10,
            backgroundColor: hexDe(p.acentoSuave),
            borderWidth: 1,
            borderColor: hexDe(p.acentoTexto) + '66',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: hexDe(p.acentoTexto),
            }}
          >
            {posicao}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '700', color: hexDe(p.tinta) }}
        >
          {item.label || item.name}
        </Text>
        <View style={{ marginTop: 3 }}>
          <PilulaEstado item={item} />
        </View>
        <View style={{ marginTop: 2 }}>
          <LinhaTempo item={item} estimativa={estimativa} />
        </View>
      </View>

      <View>
        <TouchableOpacity
          onPress={onSubir}
          disabled={!podeSubir}
          accessibilityRole="button"
          accessibilityLabel={t('fila.subir')}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: podeSubir ? 1 : 0.3,
          }}
        >
          <Ionicons name="chevron-up" size={20} color={hexDe(p.tinta)} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDescer}
          disabled={!podeDescer}
          accessibilityRole="button"
          accessibilityLabel={t('fila.descer')}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: podeDescer ? 1 : 0.3,
          }}
        >
          <Ionicons name="chevron-down" size={20} color={hexDe(p.tinta)} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};
