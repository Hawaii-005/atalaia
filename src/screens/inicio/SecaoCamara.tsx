import React from 'react';
import {
  Pressable,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  espaco,
  obterPaleta,
  raio,
  texto as tipos,
} from '../../theme/tokensV6';
import { htmlDoVideo } from '../../utils/cameraStream';
import { t, useIdioma } from '../../i18n';

type Props = {
  host: string;
  /** Só quando o ecrã está em foco: a impressora aceita uma ligação de vídeo de cada vez. */
  activa: boolean;
  /** Tablet: a câmara já é grande. Telemóvel: faixa que abre. */
  grande?: boolean;
  aberta?: boolean;
  onAbrir?: () => void;
  onFechar?: () => void;
  luzLigada?: boolean;
  onLuz?: () => void;
  onAbrirCamara?: () => void;
  style?: StyleProp<ViewStyle>;
};

const Moldura = ({
  host,
  activa,
  aberta,
  style,
}: Pick<Props, 'host' | 'activa' | 'aberta' | 'style'>) => (
  <View
    style={[
      {
        borderRadius: raio.cartao,
        overflow: 'hidden',
        backgroundColor: '#000',
        aspectRatio: 16 / 9,
      },
      style,
    ]}
  >
    {activa && host ? (
      <WebView
        key={`inicio-cam-${host}`}
        source={{
          html: htmlDoVideo(host, 'cover', false),
          baseUrl: `http://${host}`,
        }}
        style={{ flex: 1, backgroundColor: '#000' }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled={false}
        mixedContentMode="always"
        originWhitelist={['*']}
        scrollEnabled={false}
        bounces={false}
      />
    ) : (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Ionicons name="videocam-off-outline" size={22} color="#8A8A8A" />
        <Text style={{ ...tipos.micro, color: '#B0B0B0' }}>
          {t('inicio.camaraSemSinal')}
        </Text>
      </View>
    )}
  </View>
);

/**
 * Bloco 2 do Início: a câmara e os dois atalhos que fazem sentido daqui.
 *
 * A impressora só aceita uma ligação de vídeo de cada vez, por isso o WebView
 * só existe com o ecrã em foco — ao trocar de aba, o vídeo é desmontado e a
 * Impressora pode usar a câmara.
 *
 * Foto e ecrã inteiro continuam no ecrã da câmara: uma foto tirada ao WebView
 * desta vista saía preta, e uma segunda implementação de captura seria pior do
 * que abrir o ecrã que já a tem.
 */
export const SecaoCamara = ({
  host,
  activa,
  grande,
  aberta,
  onAbrir,
  onFechar,
  luzLigada,
  onLuz,
  onAbrirCamara,
  style,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = obterPaleta(tema.id);

  const botao = (
    icone: keyof typeof Ionicons.glyphMap,
    texto: string,
    aoTocar?: () => void,
    activo?: boolean
  ) => (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={{
        flex: 1,
        height: 40,
        borderRadius: raio.botao,
        borderWidth: 1,
        borderColor: activo ? p.primaria : p.contorno,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: activo ? p.cartaoAlt : 'transparent',
      }}
    >
      <Ionicons name={icone} size={16} color={activo ? p.primaria : p.texto} />
      <Text numberOfLines={1} style={{ ...tipos.microForte, color: p.texto }}>
        {texto}
      </Text>
    </Pressable>
  );

  // Tablet e telemóvel com a câmara aberta: vídeo grande e os atalhos por baixo.
  if (grande || aberta) {
    return (
      <View style={[{ gap: espaco.sm }, style]}>
        <Moldura host={host} activa={activa} aberta={aberta} />
        <View style={{ flexDirection: 'row', gap: espaco.sm }}>
          {botao('expand-outline', t('inicio.verAoVivo'), onAbrirCamara)}
          {botao(
            luzLigada ? 'bulb' : 'bulb-outline',
            t('controlos.luz'),
            onLuz,
            luzLigada
          )}
          {!grande && aberta
            ? botao('chevron-up', t('comum.fechar'), onFechar)
            : null}
        </View>
      </View>
    );
  }

  // Telemóvel: faixa de uma linha; tocar abre o vídeo.
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={t('inicio.abrirCamara')}
      style={[
        {
          height: 64,
          borderRadius: raio.cartao,
          backgroundColor: p.cartao,
          borderWidth: 1,
          borderColor: p.contorno,
          flexDirection: 'row',
          alignItems: 'center',
          gap: espaco.md,
          paddingHorizontal: espaco.md,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 44,
          height: 36,
          borderRadius: raio.interno,
          backgroundColor: p.cartaoAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="videocam-outline" size={18} color={p.primaria} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...tipos.legendaForte, color: p.texto }}>
          {t('inicio.camara')}
        </Text>
        <Text
          numberOfLines={1}
          style={{ ...tipos.micro, color: p.textoSecundario }}
        >
          {t('inicio.abrirCamara')}
        </Text>
      </View>
      <Ionicons name="chevron-up" size={18} color={p.textoSecundario} />
    </TouchableOpacity>
  );
};
