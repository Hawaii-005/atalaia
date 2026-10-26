import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { espaco, raio as raioToken } from '../theme/tokensV6';
import { t } from '../i18n';
import { Printer } from '../types';
import {
  ackDaResposta,
  fanCommand,
  homeCommand,
  jogCommand,
  lightCommand,
  printSpeedCommand,
  timelapseCommand,
} from '../utils/commands';
import { guardarTimelapse, lerTimelapse } from '../utils/timelapse';

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
  // A máquina recusa o comando fora de uma impressão; o que conta é a
  // preferência guardada, que vai no Tlp_Switch do próximo arranque.
  const [tlPref, setTlPref] = useState<boolean | null>(null);
  useEffect(() => {
    if (!printer?.id) return;
    let vivo = true;
    lerTimelapse(printer.id).then(valor => {
      if (vivo) setTlPref(valor);
    });
    return () => {
      vivo = false;
    };
  }, [printer?.id]);
  const timeLapse = tlPref ?? (printer?.status?.TimeLapseStatus ?? 0) > 0;
  const velocidade = printer?.status?.PrintInfo?.PrintSpeedPct ?? 100;
  const ventoinhas = printer?.status?.CurrentFanSpeed ?? { ModelFan: 0, AuxiliaryFan: 0, BoxFan: 0 };

  const [passo, setPasso] = useState(10);
  const corrente = Number(printer?.status?.CurrentStatus?.[0] ?? 0);
  const ocupada = [1, 6, 13, 16, 20].includes(corrente);

  const mover = async (eixo: 'X' | 'Y' | 'Z', sentido: 1 | -1) => {
    if (!printer) return;
    try {
      const resposta = await request(
        printer.id,
        jogCommand(eixo, sentido * passo, { id: printer.id }),
        8000
      );
      if (ackDaResposta(resposta) === 3) {
        Alert.alert(t('controlos.movimento'), t('controlos.precisaHome'));
      }
    } catch (e) {
      Alert.alert(t('comum.erro'), e instanceof Error ? e.message : String(e));
    }
  };

  const fazerHomeXY = () => {
    Alert.alert(t('controlos.confirmarHome'), t('controlos.confirmarHomeMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('comum.confirmar'),
        style: 'destructive',
        onPress: async () => {
          await enviar(homeCommand('X', { id: printer?.id }));
          await new Promise(resolver => setTimeout(resolver, 1200));
          await enviar(homeCommand('Y', { id: printer?.id }));
        },
      },
    ]);
  };

  const fazerHome = (eixo: 'XYZ' | 'Z') => {
    Alert.alert(t('controlos.confirmarHome'), t('controlos.confirmarHomeMsg'), [
      { text: t('comum.cancelar'), style: 'cancel' },
      {
        text: t('comum.confirmar'),
        style: 'destructive',
        onPress: () => enviar(homeCommand(eixo, { id: printer?.id })),
      },
    ]);
  };

  const enviar = async (cmd: any, avisar = true) => {
    if (!printer) return;
    try {
      await request(printer.id, cmd, 8000);
    } catch (e) {
      if (avisar) Alert.alert(t('comum.erro'), e instanceof Error ? e.message : String(e));
    }
  };

  const numeros = (printer?.status?.CurrenCoord ?? '').match(/-?\d+(?:\.\d+)?/g) ?? [];
  const coord = (i: number) => numeros[i] ?? '0.00';
  const desactivado = !ligada || ocupada;

  const Tecla: React.FC<{ etiqueta: string; onPress: () => void; largo?: boolean }> = ({
    etiqueta,
    onPress,
    largo,
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={desactivado}
      activeOpacity={0.75}
      style={{
        flex: largo ? 1 : undefined,
        minWidth: largo ? 0 : 58,
        height: 46,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: 1.2,
        borderColor: hexDe(paleta.linha),
        backgroundColor: hexDe(paleta.fundoBaixo),
        alignItems: 'center',
        justifyContent: 'center',
        opacity: desactivado ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: hexDe(paleta.tinta) }}>
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );

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
        icone="film-outline"
        titulo={t('controlos.timeLapse')}
        ligado={timeLapse}
        desactivado={!ligada}
        onPress={() => {
          if (!printer?.id) return;
          const novo = !timeLapse;
          setTlPref(novo);
          guardarTimelapse(printer.id, novo);
          enviar(timelapseCommand(novo, { id: printer.id }), false);
        }}
      />

      <Text style={{ fontSize: 13, fontWeight: '700', color: hexDe(paleta.tintaSoft), marginTop: espaco.md }}>
        {t('controlos.movimento')}
      </Text>
      <View
        style={{
          backgroundColor: hexDe(paleta.cartao),
          borderRadius: raioToken.interno,
          borderWidth: 1,
          borderColor: hexDe(paleta.linha),
          padding: espaco.md,
          gap: espaco.sm,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0.1, 1, 10, 50].map(mm => (
            <TouchableOpacity
              key={mm}
              onPress={() => setPasso(mm)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: passo === mm ? hexDe(paleta.acento) : hexDe(paleta.fundoBaixo),
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: passo === mm ? '#fff' : hexDe(paleta.tintaSoft),
                }}
              >
                {mm === 0.1 ? '0.1 mm' : `${mm} mm`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['X', 'Y', 'Z'] as const).map((eixo, i) => (
            <View
              key={eixo}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 8,
                backgroundColor: hexDe(paleta.fundoBaixo),
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: hexDe(paleta.acento) }}>
                {eixo}:{' '}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: hexDe(paleta.tinta) }}>
                {coord(i)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: espaco.md, marginTop: 2 }}>
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Tecla etiqueta="▲ Y+" onPress={() => mover('Y', 1)} />
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Tecla etiqueta="◀ X−" onPress={() => mover('X', -1)} />
              <TouchableOpacity
                onPress={() => fazerHome('XYZ')}
                disabled={desactivado}
                activeOpacity={0.75}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1.5,
                  borderColor: hexDe(paleta.acento),
                  backgroundColor: hexDe(paleta.fundoBaixo),
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: desactivado ? 0.4 : 1,
                }}
              >
                <Ionicons name="home" size={18} color={hexDe(paleta.tinta)} />
              </TouchableOpacity>
              <Tecla etiqueta="X+ ▶" onPress={() => mover('X', 1)} />
            </View>
            <Tecla etiqueta="▼ Y−" onPress={() => mover('Y', -1)} />
          </View>

          <View style={{ width: 104, justifyContent: 'center', gap: 10 }}>
            <Tecla etiqueta="▲ Z+" onPress={() => mover('Z', 1)} />
            <Tecla etiqueta="▼ Z−" onPress={() => mover('Z', -1)} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Tecla etiqueta="Home XY" largo onPress={fazerHomeXY} />
          <Tecla etiqueta="Home Z" largo onPress={() => fazerHome('Z')} />
        </View>

        {ocupada ? (
          <Text style={{ fontSize: 11, color: hexDe(paleta.tintaSoft) }}>
            {t('controlos.aImprimir')}
          </Text>
        ) : null}
      </View>

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

    </ScrollView>
  );
};
