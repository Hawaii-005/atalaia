import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { larguraRail } from '../theme/layout';
import PrinterIcon from './icons/PrinterIcon';
import { t } from '../i18n';

const ICONES: Record<string, { activo: keyof typeof Ionicons.glyphMap; inactivo: keyof typeof Ionicons.glyphMap }> = {
  Inicio: { activo: 'home', inactivo: 'home-outline' },
  Settings: { activo: 'settings', inactivo: 'settings-outline' },
};

const ROTULOS: Record<string, string> = {
  Inicio: 'inicio.titulo',
  Impressora: 'aba.impressora',
  Settings: 'settings.title',
};

/**
 * Rail de navegação para tablets (largura ≥ 600 dp). Mesmas três rotas da barra
 * inferior, para que `navigate('Impressora')` funcione em qualquer shell.
 */
export const RailLateral = ({ state, navigation }: any) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;

  return (
    <View
      style={{
        width: larguraRail,
        flex: 1,
        backgroundColor: hexDe(paleta.cartao),
        borderRightWidth: 1,
        borderRightColor: hexDe(paleta.linha),
        paddingTop: 24,
        paddingBottom: 24,
        alignItems: 'center',
        gap: 8,
      }}
    >
      {state.routes.map((rota: any, indice: number) => {
        const activo = state.index === indice;
        const icone = ICONES[rota.name];
        const cor = activo ? hexDe(paleta.acento) : hexDe(paleta.tintaSoft);

        return (
          <TouchableOpacity
            key={rota.key}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={t(ROTULOS[rota.name] as any)}
            onPress={() => navigation.navigate(rota.name)}
            style={{
              width: larguraRail - 16,
              minHeight: 64,
              borderRadius: 18,
              backgroundColor: activo ? hexDe(paleta.acentoSuave) : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              paddingVertical: 8,
            }}
          >
            {rota.name === 'Impressora' ? (
              <PrinterIcon variant={activo ? 'filled' : 'outline'} size={24} color={cor} />
            ) : (
              <Ionicons name={activo ? icone.activo : icone.inactivo} size={24} color={cor} />
            )}
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: activo ? '700' : '600', color: cor }}
            >
              {t(ROTULOS[rota.name] as any)}
            </Text>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('fila.titulo')}
        onPress={() => navigation.getParent()?.navigate('Fila')}
        style={{
          width: larguraRail - 16,
          minHeight: 64,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingVertical: 8,
        }}
      >
        <Ionicons name="list-outline" size={24} color={hexDe(paleta.tintaSoft)} />
        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: hexDe(paleta.tintaSoft) }}>
          {t('fila.curto')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
