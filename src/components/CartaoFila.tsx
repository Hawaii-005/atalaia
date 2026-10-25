import React from 'react';
import { Alert, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { hexDe } from '../theme/temas';
import { t } from '../i18n';

type Props = {
  /** Deixa o cartão crescer até ao fundo do ecrã (ecrã da fila). */
  esticar?: boolean;
  /** Mostra o interruptor do arranque automático. */
  mostrarAuto?: boolean;
  /** Esconde o título quando o ecrã já tem o seu próprio cabeçalho. */
  mostrarTitulo?: boolean;
  onAbrir?: () => void;
};

/**
 * Lista da fila: remover um trabalho, limpar tudo e ligar o arranque do
 * próximo. Antes só existia o contador nas Definições — não havia forma de
 * apagar o que estava à espera.
 */
export const CartaoFila = ({ esticar, mostrarAuto = true, mostrarTitulo = true, onAbrir }: Props) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const { fila, removerDaFila, limparFila, filaAuto, definirFilaAuto, printers } = usePrinterConnections();

  const nomeDaMaquina = (printerId: string) =>
    printers.find(imp => imp.id === printerId)?.printerName ?? printerId;

  const limpar = () => {
    if (fila.length === 0) return;
    Alert.alert(t('fila.limparTudo'), t('fila.confirmarLimpar', { n: fila.length }), [
      { text: t('comum.cancelar'), style: 'cancel' },
      { text: t('fila.limpar'), style: 'destructive', onPress: limparFila },
    ]);
  };

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: hexDe(p.linha),
        backgroundColor: hexDe(p.cartao),
        paddingHorizontal: 14,
        paddingVertical: 12,
        flex: esticar ? 1 : undefined,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {mostrarTitulo ? (
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: hexDe(p.tinta) }}>
            {t('fila.titulo')}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {fila.length > 0 && (
          <TouchableOpacity
            onPress={limpar}
            accessibilityRole="button"
            accessibilityLabel={t('fila.limparTudo')}
            style={{
              borderWidth: 1.5,
              borderColor: hexDe(p.perigo) + '80',
              backgroundColor: hexDe(p.perigo) + '1A',
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: hexDe(p.perigo) }}>
              {t('fila.limparTudo')}
            </Text>
          </TouchableOpacity>
        )}
        {onAbrir && (
          <TouchableOpacity onPress={onAbrir} accessibilityRole="button">
            <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(p.acentoTexto) }}>
              {t('inicio.verTudo')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {fila.length === 0 ? (
        <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft), paddingVertical: 12 }}>
          {t('fila.vazia')}
        </Text>
      ) : (
        fila.map((item, indice) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              borderTopWidth: indice === 0 ? 0 : 1,
              borderTopColor: hexDe(p.linha) + '66',
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: hexDe(p.fundoBaixo),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: hexDe(p.tintaSoft) }}>{indice + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: hexDe(p.tinta) }}>
                {item.label || item.name}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: hexDe(p.tintaSoft), marginTop: 2 }}>
                {nomeDaMaquina(item.printerId)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removerDaFila(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t('fila.remover')} ${item.name}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: hexDe(p.linha),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={15} color={hexDe(p.tintaSoft)} />
            </TouchableOpacity>
          </View>
        ))
      )}

      {mostrarAuto && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingTop: 12,
            marginTop: esticar ? 'auto' : 4,
            borderTopWidth: 1,
            borderTopColor: hexDe(p.linha) + '66',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(p.tinta) }}>
              {t('settings.filaAuto')}
            </Text>
            <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft), marginTop: 2 }}>
              {t('settings.filaAutoDesc')}
            </Text>
          </View>
          <Switch
            value={filaAuto}
            onValueChange={definirFilaAuto}
            trackColor={{ false: hexDe(p.linha), true: hexDe(p.acento) }}
            thumbColor="#fff"
          />
        </View>
      )}
    </View>
  );
};
