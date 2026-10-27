import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t, useIdioma } from '../i18n';

type Props = {
  host: string;
  printerName: string;
  onAbrir: () => void;
  altura?: number;
  /** Ocupa o espaço que sobra na coluna (tablet em horizontal). */
  esticar?: boolean;
};

/**
 * Cartão da câmara no Início dos ecrãs largos.
 *
 * Não mostra imagem: esta firmware responde 500 a `/snapshot` (o vídeo só
 * existe em `/video`, MJPEG, que o <Image> não lê). Fica como porta de entrada
 * para o ecrã da câmara, com o nome da máquina.
 */
export const CartaoCamara = ({ printerName, onAbrir, altura = 180, esticar }: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  return (
    <View
      style={{
        ...(esticar ? { flex: 1 } : { height: altura }),
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: hexDe(p.linha),
        backgroundColor: hexDe(p.cartao),
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: hexDe(p.tinta) }}>
          {t('inicio.camara')}
        </Text>
        <TouchableOpacity onPress={onAbrir} accessibilityRole="button">
          <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(p.acentoTexto) }}>
            {t('inicio.verAoVivo')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onAbrir}
        accessibilityRole="button"
        accessibilityLabel={`${t('inicio.camara')} · ${printerName}`}
        activeOpacity={0.85}
        style={{
          flex: 1,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: hexDe(p.linha) + '88',
          backgroundColor: hexDe(p.fundoBaixo),
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 12,
        }}
      >
        <Ionicons name="videocam-outline" size={34} color={hexDe(p.acentoTexto)} />
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: hexDe(p.tinta) }}>
          {printerName}
        </Text>
        <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft), textAlign: 'center' }}>
          {t('inicio.camaraAjuda')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
