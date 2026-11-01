import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';

type Props = {
  impressoras: { id: string; nome: string; contagem: number }[];
  atual?: string;
  onEscolher: (id: string) => void;
  /** «Fila por impressora»: cada máquina tem a sua ordem. */
  nota: string;
};

/** Chips das impressoras, com a contagem de trabalhos de cada uma. */
export const ChipsImpressora = ({
  impressoras,
  atual,
  onEscolher,
  nota,
}: Props) => {
  const { tema } = useTheme();
  const p = tema.paleta;

  if (impressoras.length <= 1) {
    return (
      <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>{nota}</Text>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
      >
        {impressoras.map(impressora => {
          const activa = impressora.id === atual;
          return (
            <TouchableOpacity
              key={impressora.id}
              onPress={() => onEscolher(impressora.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: activa ? hexDe(p.acentoTexto) : hexDe(p.linha),
                backgroundColor: activa
                  ? hexDe(p.acentoSuave)
                  : hexDe(p.cartao),
              }}
            >
              <Ionicons
                name="print-outline"
                size={15}
                color={activa ? hexDe(p.acentoTexto) : hexDe(p.tintaSoft)}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: activa ? hexDe(p.acentoTexto) : hexDe(p.tinta),
                }}
              >
                {impressora.nome}
              </Text>
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 5,
                  borderRadius: 10,
                  backgroundColor: activa
                    ? hexDe(p.cartao)
                    : hexDe(p.fundoBaixo),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: activa ? hexDe(p.acentoTexto) : hexDe(p.tintaSoft),
                  }}
                >
                  {impressora.contagem}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft), marginTop: 6 }}>
        {nota}
      </Text>
    </View>
  );
};
