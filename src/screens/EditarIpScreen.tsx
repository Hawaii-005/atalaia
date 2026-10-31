import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t, useIdioma } from '../i18n';

/**
 * Editar IP — a app só atualizava o endereço pela descoberta na rede local.
 * Fora de casa (ou com o DHCP a trocar o IP) é preciso escrevê-lo à mão:
 * pode ser o da impressora na LAN ou o de um encaminhador na tailnet.
 */
export const EditarIpScreen = ({ route, navigation }: any) => {
  useIdioma();
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers, updatePrinterIp } = usePrinterConnections();

  const printer = printers.find(p => p.id === route?.params?.printerId);
  const [ip, setIp] = useState(printer?.ipAddress ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const valido =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(ip.trim()) &&
    ip
      .trim()
      .split('.')
      .every(p => Number(p) <= 255);

  const guardar = () => {
    if (!printer) return;
    if (!valido) {
      setErro(t('editarIp.invalido'));
      return;
    }
    updatePrinterIp(printer.id, ip.trim());
    navigation.goBack();
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }}
      edges={['top']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 8,
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('comum.voltar')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: hexDe(paleta.cartao),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={hexDe(paleta.tinta)}
            />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: hexDe(paleta.tinta),
            }}
          >
            {t('editarIp.titulo')}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text
            style={{
              fontSize: 13,
              color: hexDe(paleta.tintaSoft),
              marginBottom: 8,
            }}
          >
            {printer?.printerName ?? t('editarIp.semMaquina')}
          </Text>

          <TextInput
            value={ip}
            onChangeText={texto => {
              setIp(texto);
              setErro(null);
            }}
            placeholder="192.168.1.4"
            placeholderTextColor={hexDe(paleta.tintaMuted)}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 52,
              borderRadius: 14,
              paddingHorizontal: 16,
              fontSize: 16,
              color: hexDe(paleta.tinta),
              backgroundColor: hexDe(paleta.cartao),
              borderWidth: 1,
              borderColor: erro ? hexDe(paleta.perigo) : hexDe(paleta.linha),
            }}
          />

          {erro && (
            <Text
              style={{
                fontSize: 12,
                color: hexDe(paleta.perigo),
                marginTop: 8,
              }}
            >
              {erro}
            </Text>
          )}

          <Text
            style={{
              fontSize: 12,
              color: hexDe(paleta.tintaSoft),
              marginTop: 14,
              lineHeight: 18,
            }}
          >
            {t('editarIp.nota')}
          </Text>

          <TouchableOpacity
            onPress={guardar}
            disabled={!valido}
            style={{
              marginTop: 24,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hexDe(paleta.acento),
              opacity: valido ? 1 : 0.5,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              {t('editarIp.guardar')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
