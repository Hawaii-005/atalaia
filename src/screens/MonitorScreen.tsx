import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { CameraScreen } from './CameraScreen';
import { WorkScreen } from './WorkScreen';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

type Aba = 'camara' | 'trabalho';

/**
 * Aba fixa do meio: mostra o que a impressora tem para mostrar.
 * Com câmara (Centauri) → vídeo; sem câmara (Saturn) → trabalho. Com as duas
 * famílias ligadas aparecem os dois botões e o utilizador escolhe. A posição da
 * aba nunca muda, para não se perder o sítio quando uma impressora sai da rede.
 */
export const MonitorScreen = ({ navigation, route }: any) => {
  const { tema } = useTheme();
  const { printers } = usePrinterConnections();

  const temCamera = useMemo(
    () => printers.some(p => p.kind !== 'resin'),
    [printers]
  );
  const temResina = useMemo(
    () => printers.some(p => p.kind === 'resin'),
    [printers]
  );

  const [aba, setAba] = useState<Aba>(temCamera ? 'camara' : 'trabalho');

  // Se a impressora que dava a aba actual desaparecer, cai para a outra.
  useEffect(() => {
    if (aba === 'camara' && !temCamera && temResina) setAba('trabalho');
    if (aba === 'trabalho' && !temResina && temCamera) setAba('camara');
  }, [aba, temCamera, temResina]);

  if (!temCamera && !temResina) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-8">
        <Ionicons name="eye-off-outline" size={28} color={hexDe(tema.paleta.tintaSoft)} />
        <Text className="text-[13px] text-ink-muted mt-3 text-center">
          {t('monitor.semImpressoras')}
        </Text>
      </View>
    );
  }

  const escolhida: Aba = !temCamera ? 'trabalho' : !temResina ? 'camara' : aba;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      {temCamera && temResina ? (
        <View className="flex-row px-4 pt-2 pb-1">
          {(['camara', 'trabalho'] as Aba[]).map(nome => {
            const activa = escolhida === nome;
            return (
              <TouchableOpacity
                key={nome}
                onPress={() => setAba(nome)}
                activeOpacity={0.8}
                className={`flex-row items-center px-3 py-2 mr-2 rounded-full border ${
                  activa ? 'bg-brand/15 border-brand' : 'border-line'
                }`}
              >
                <Ionicons
                  name={nome === 'camara' ? 'videocam' : 'layers'}
                  size={13}
                  color={hexDe(activa ? tema.paleta.acentoTexto : tema.paleta.tintaSoft)}
                />
                <Text
                  className={`ml-2 text-[12px] ${
                    activa ? 'text-ink font-semibold' : 'text-ink-soft'
                  }`}
                >
                  {nome === 'camara' ? t('monitor.camara') : t('monitor.trabalho')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View className="flex-1">
        {escolhida === 'camara' ? (
          <CameraScreen navigation={navigation} route={route} dentroDoMonitor />
        ) : (
          <WorkScreen navigation={navigation} route={route} dentroDoMonitor />
        )}
      </View>
    </SafeAreaView>
  );
};
