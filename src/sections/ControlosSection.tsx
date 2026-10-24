import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { espaco, raio as raioToken } from '../theme/tokensV6';
import { t } from '../i18n';
import { Printer } from '../types';
import {
  fanCommand,
  lightCommand,
  printSpeedCommand,
  skipPreheatCommand,
  stopFilamentCommand,
  timelapseCommand,
  videoCommand,
} from '../utils/commands';

const Linha: React.FC<{
  titulo: string;
  valor?: string;
  ligado?: boolean;
  onPress: () => void;
  desactivado?: boolean;
  icone?: keyof typeof Ionicons.glyphMap;
}> = ({ titulo, valor, ligado, onPress, desactivado, icone }) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desactivado}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espaco.md,
        paddingVertical: 14,
        paddingHorizontal: espaco.lg,
        backgroundColor: hexDe(paleta.cartao),
        borderRadius: raioToken.interno,
        opacity: desactivado ? 0.4 : 1,
      }}
    >
      {icone && <Ionicons name={icone} size={18} color={hexDe(paleta.tintaSoft)} />}
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: hexDe(paleta.tinta) }}>{titulo}</Text>
      {typeof ligado === 'boolean' ? (
        <View
          style={{
            width: 50,
            height: 30,
            borderRadius: 15,
            padding: 4,
            backgroundColor: ligado ? hexDe(paleta.acento) : hexDe(paleta.linha),
            alignItems: ligado ? 'flex-end' : 'flex-start',
          }}
        >
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} />
        </View>
      ) : (
        <Text style={{ fontSize: 13, color: hexDe(paleta.tintaSoft) }}>{valor}</Text>
      )}
    </TouchableOpacity>
  );
};

export const ControlosSection = ({ printer }: { printer?: Printer }) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { request } = usePrinterConnections();

  const ligada = printer?.connectionStatus === 'connected';
  const luz = !!printer?.status?.LightStatus?.SecondLight;
  const timeLapse = (printer?.status?.TimeLapseStatus ?? 0) > 0;
  const velocidade = printer?.status?.PrintInfo?.PrintSpeedPct ?? 100;
  const ventoinhas = printer?.status?.CurrentFanSpeed ?? { ModelFan: 0, AuxiliaryFan: 0, BoxFan: 0 };

  const enviar = async (cmd: any) => {
    if (!printer) return;
    try {
      await request(printer.id, cmd, 8000);
    } catch (e) {
      Alert.alert(t('comum.erro'), e instanceof Error ? e.message : String(e));
    }
  };

  const alterarVentoinha = (campo: 'model' | 'side' | 'chamber', passo: number) => {
    const actual = {
      model: ventoinhas.ModelFan ?? 0,
      side: ventoinhas.AuxiliaryFan ?? 0,
      chamber: ventoinhas.BoxFan ?? 0,
    }[campo];
    const valor = Math.max(0, Math.min(100, actual + passo));
    enviar(
      fanCommand({
        model: campo === 'model' ? valor : ventoinhas.ModelFan ?? 0,
        side: campo === 'side' ? valor : ventoinhas.AuxiliaryFan ?? 0,
        chamber: campo === 'chamber' ? valor : ventoinhas.BoxFan ?? 0,
      }, { id: printer?.id })
    );
  };

  const Ventoinha: React.FC<{ rotulo: string; valor: number; campo: 'model' | 'side' | 'chamber' }> = ({
    rotulo,
    valor,
    campo,
  }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: espaco.lg,
        paddingVertical: 12,
        backgroundColor: hexDe(paleta.cartao),
        borderRadius: raioToken.interno,
        gap: espaco.md,
      }}
    >
      <Text style={{ flex: 1, fontSize: 14, color: hexDe(paleta.tinta) }}>{rotulo}</Text>
      <TouchableOpacity
        onPress={() => alterarVentoinha(campo, -10)}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hexDe(paleta.fundoBaixo), alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="remove" size={16} color={hexDe(paleta.tinta)} />
      </TouchableOpacity>
      <Text style={{ width: 44, textAlign: 'center', fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta) }}>{Math.round(valor)}%</Text>
      <TouchableOpacity
        onPress={() => alterarVentoinha(campo, 10)}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hexDe(paleta.fundoBaixo), alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="add" size={16} color={hexDe(paleta.tinta)} />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: espaco.lg, gap: espaco.sm, paddingBottom: 32 }}>
      <Linha
        icone="bulb-outline"
        titulo={t('controlos.luz')}
        ligado={luz}
        desactivado={!ligada}
        onPress={() => enviar(lightCommand(!luz, { id: printer?.id }))}
      />
      <Linha
        icone="videocam-outline"
        titulo={t('controlos.camara')}
        valor={t('controlos.ligarCamara')}
        desactivado={!ligada}
        onPress={() => enviar(videoCommand(true, { id: printer?.id }))}
      />
      <Linha
        icone="film-outline"
        titulo={t('controlos.timeLapse')}
        ligado={timeLapse}
        desactivado={!ligada}
        onPress={() => enviar(timelapseCommand(!timeLapse, { id: printer?.id }))}
      />

      <Text style={{ fontSize: 13, fontWeight: '700', color: hexDe(paleta.tintaSoft), marginTop: espaco.md }}>
        {t('controlos.velocidade')}
      </Text>
      <View style={{ flexDirection: 'row', gap: espaco.sm }}>
        {[50, 100, 150, 200].map(pct => {
          const activo = Math.round(velocidade) === pct;
          return (
            <TouchableOpacity
              key={pct}
              onPress={() => enviar(printSpeedCommand(pct, { id: printer?.id }))}
              disabled={!ligada}
              style={{
                flex: 1,
                height: 40,
                borderRadius: raioToken.chip,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: activo ? hexDe(paleta.acento) : hexDe(paleta.cartao),
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: activo ? '#fff' : hexDe(paleta.tinta) }}>
                {`${pct}%`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontSize: 13, fontWeight: '700', color: hexDe(paleta.tintaSoft), marginTop: espaco.md }}>
        {t('controlos.ventoinhas')}
      </Text>
      <Ventoinha rotulo={t('controlos.ventoinhaBico')} valor={ventoinhas.ModelFan ?? 0} campo="model" />
      <Ventoinha rotulo={t('controlos.ventoinhaAuxiliar')} valor={ventoinhas.AuxiliaryFan ?? 0} campo="side" />
      <Ventoinha rotulo={t('controlos.ventoinhaCaixa')} valor={ventoinhas.BoxFan ?? 0} campo="chamber" />

      <Text style={{ fontSize: 13, fontWeight: '700', color: hexDe(paleta.tintaSoft), marginTop: espaco.md }}>
        {t('controlos.avancado')}
      </Text>
      <Linha
        titulo={t('controlos.saltarPreAquecimento')}
        valor={t('comum.enviar')}
        desactivado={!ligada}
        onPress={() => enviar(skipPreheatCommand({ id: printer?.id }))}
      />
      <Linha
        titulo={t('controlos.pararFilamento')}
        valor={t('comum.enviar')}
        desactivado={!ligada}
        onPress={() => enviar(stopFilamentCommand({ id: printer?.id }))}
      />
    </ScrollView>
  );
};
