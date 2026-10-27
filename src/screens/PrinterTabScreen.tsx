import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useSelectedPrinter, secoesDaMaquina, Secao } from '../contexts/SelectedPrinterContext';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { EstadoVazio } from '../ui/EstadoVazio';
import { hexDe } from '../theme/temas';
import { espaco, raio as raioToken, texto as textoToken } from '../theme/tokensV6';
import { t, useIdioma } from '../i18n';
import { EstadoSection } from '../sections/EstadoSection';
import { PainelSection } from '../sections/PainelSection';
import { FilamentosScreen } from '../screens/FilamentosScreen';
import { FilesScreen } from '../screens/FilesScreen';

const ETIQUETAS: Record<Secao, string> = {
  painel: 'secao.painel',
  estado: 'secao.estado',
  ficheiros: 'secao.ficheiros',
  filamentos: 'secao.filamentos',
};

/**
 * Aba Impressora: uma pílula por máquina e um controlo segmentado com as
 * secções que aquela máquina tem. As secções são componentes, não stacks —
 * trocar de secção não empilha ecrãs nem perde o estado.
 */
export const PrinterTabScreen = ({ navigation }: any) => {
  useIdioma();
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers, removePrinter, reconnectAll } = usePrinterConnections();
  const { maquina, secao, mudarMaquina, mudarSecao } = useSelectedPrinter();

  const secoes = secoesDaMaquina(maquina);
  const ligada = maquina?.connectionStatus === 'connected';

  const corDoPonto = ligada ? hexDe(paleta.ok) : hexDe(paleta.perigo);

  const corpo = () => {
    if (!maquina) {
      return (
        <EstadoVazio
          pose="ocioso"
          titulo={t('vazio.semImpressoras.titulo')}
          descricao={t('vazio.semImpressoras.descricao')}
          acaoPrimaria={{
            rotulo: t('home.adicionarImpressora'),
            aoTocar: () => navigation.navigate('AddEditPrinter'),
          }}
          acaoSecundaria={{
            rotulo: t('vazio.analisarRede'),
            aoTocar: () => navigation.navigate('Discovery'),
          }}
        />
      );
    }

    switch (secao) {
      case 'ficheiros':
        return <FilesScreen printerId={maquina.id} embutido navigation={navigation} />;
      case 'filamentos':
        return <FilamentosScreen printerId={maquina.id} embutido />;
      case 'estado':
        return (
          <EstadoSection
            printer={maquina}
            onAbrirCamara={() => navigation.navigate('Camera', { printerId: maquina.id })}
          />
        );
      default:
        return (
          <PainelSection
            printer={maquina}
            onAbrirCamara={() => navigation.navigate('Camera', { printerId: maquina.id })}
          />
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          gap: 8,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontSize: textoToken.tituloEcra.fontSize,
            lineHeight: textoToken.tituloEcra.lineHeight,
            fontWeight: '700',
            color: hexDe(paleta.tinta),
          }}
        >
          {t('aba.impressora')}
        </Text>
        {maquina ? (
          <>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('EditarIp', { printerId: maquina.id })
              }
              accessibilityRole="button"
              accessibilityLabel={t('editarIp.titulo')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: hexDe(paleta.cartao),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="pencil" size={16} color={hexDe(paleta.tintaSoft)} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  t('details.desassociar'),
                  t('details.desassociarMsg', { nome: maquina.printerName }),
                  [
                    { text: t('comum.cancelar'), style: 'cancel' },
                    {
                      text: t('details.desassociar'),
                      style: 'destructive',
                      onPress: () => removePrinter(maquina.id),
                    },
                  ]
                )
              }
              accessibilityRole="button"
              accessibilityLabel={t('details.desassociar')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: hexDe(paleta.cartao),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={16} color={hexDe(paleta.perigo)} />
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingVertical: espaco.md, gap: espaco.sm }}
      >
        {printers.map(p => {
          const activa = p.id === maquina?.id;
          const ponto = p.connectionStatus === 'connected' ? hexDe(paleta.ok) : hexDe(paleta.perigo);
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => mudarMaquina(p.id)}
              onLongPress={() =>
                Alert.alert(p.printerName, `${p.ipAddress}`, [
                  { text: t('comum.cancelar'), style: 'cancel' },
                  {
                    text: t('comum.eliminar'),
                    style: 'destructive',
                    onPress: () => removePrinter(p.id),
                  },
                ])
              }
              accessibilityRole="button"
              accessibilityState={{ selected: activa }}
              style={{
                height: 44,
                paddingHorizontal: espaco.lg,
                borderRadius: raioToken.chip,
                flexDirection: 'row',
                alignItems: 'center',
                gap: espaco.sm,
                backgroundColor: activa ? hexDe(paleta.acentoSuave) : hexDe(paleta.cartao),
                borderWidth: activa ? 1.5 : 0,
                borderColor: hexDe(paleta.acento),
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ponto }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta) }}>
                {p.printerName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {secoes.length > 1 && (
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: espaco.lg,
            padding: 3,
            borderRadius: raioToken.chip,
            backgroundColor: hexDe(paleta.cartao),
            gap: 3,
          }}
        >
          {secoes.map(s => {
            const activa = s === secao;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => mudarSecao(s)}
                accessibilityRole="button"
                accessibilityState={{ selected: activa }}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: raioToken.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: activa ? hexDe(paleta.acento) : 'transparent',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: activa ? '700' : '600',
                    color: activa ? '#fff' : hexDe(paleta.tintaSoft),
                  }}
                >
                  {t(ETIQUETAS[s] as any)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={{ flex: 1, marginTop: secoes.length > 1 ? espaco.md : 0 }}>{corpo()}</View>
    </SafeAreaView>
  );
};
