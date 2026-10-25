import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { CartaoFila } from '../components/CartaoFila';
import { t } from '../i18n';

/** Ecrã da fila: ver, remover e limpar os trabalhos à espera. */
export const FilaScreen = ({ navigation }: any) => {
  const { tema } = useTheme();
  const p = tema.paleta;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: hexDe(p.fundo) }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('comum.voltar')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: hexDe(p.cartao),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={20} color={hexDe(p.tinta)} />
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: hexDe(p.tinta) }}>{t('fila.titulo')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
        <CartaoFila esticar mostrarTitulo={false} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default FilaScreen;
