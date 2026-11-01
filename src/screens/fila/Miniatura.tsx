import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';

type Props = { nome?: string; tamanho: number };

/**
 * Miniatura do item a partir da cache da app. O item guarda só o nome do
 * ficheiro; se ele já não existir (cache limpa, backup de outro telemóvel)
 * fica o marcador — nunca uma imagem inventada.
 */
export const Miniatura = ({ nome, tamanho }: Props) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const [uri, setUri] = useState<string>();

  useEffect(() => {
    let vivo = true;
    if (!nome) {
      setUri(undefined);
      return undefined;
    }
    const caminho = `${FileSystem.cacheDirectory}atalaia/miniaturas/${nome}`;
    FileSystem.getInfoAsync(caminho)
      .then(info => {
        if (vivo && info.exists) setUri(caminho);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [nome]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: tamanho, height: tamanho, borderRadius: 12 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: 12,
        backgroundColor: hexDe(p.fundoBaixo),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name="cube-outline"
        size={tamanho * 0.44}
        color={hexDe(p.tintaSoft)}
      />
    </View>
  );
};
