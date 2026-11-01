import React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { ItemFila, podeReordenar } from '../../utils/fila/modelo';
import { EstimativaItem, formatarHora } from '../../utils/fila/estimativas';
import { formatDuracao } from '../../utils/duracao';
import { localeActual, t, useIdioma } from '../../i18n';
import { IconeDoEstado, PilulaEstado } from './estado';

type Props = {
  item?: ItemFila;
  posicao: number;
  total: number;
  estimativa?: EstimativaItem;
  impressora: string;
  visivel: boolean;
  /** No tablet o detalhe é um painel ao lado da lista, não uma folha. */
  painel?: boolean;
  onFechar: () => void;
  /** Arrancar este item (pede «Mesa limpa?»); ausente se não pode arrancar. */
  onArrancar?: () => void;
  onMover: (destino: number) => void;
  onDuplicar: () => void;
  onRemover: () => void;
};

/** Detalhe do trabalho: estado, motivo, estimativas, posição e ações. */
export const DetalheItem = ({
  item,
  posicao,
  total,
  estimativa,
  impressora,
  visivel,
  painel,
  onFechar,
  onArrancar,
  onMover,
  onDuplicar,
  onRemover,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  if (!item) return null;

  const reordenavel = podeReordenar(item);
  const duracao = formatDuracao(item.duracaoSeg ?? estimativa?.duracaoSeg);
  const inicio = formatarHora(estimativa?.inicio, localeActual());
  const fim = formatarHora(estimativa?.fim, localeActual());

  const linhas = [
    { rotulo: t('fila.detalheImpressora'), valor: impressora },
    { rotulo: t('fila.detalheTamanho'), valor: formatarTamanho(item.tamanho) },
    { rotulo: t('fila.detalheDuracao'), valor: duracao || t('fila.semTempo') },
    { rotulo: t('fila.detalheInicio'), valor: inicio ?? '—' },
    { rotulo: t('fila.detalheFim'), valor: fim ?? '—' },
    { rotulo: t('fila.detalhePosicao'), valor: `${posicao} / ${total}` },
  ];

  const confirmarRemover = () => {
    Alert.alert(
      t('fila.removerTitulo'),
      t('fila.confirmarRemover', { nome: item.label || item.name }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        { text: t('fila.remover'), style: 'destructive', onPress: onRemover },
      ]
    );
  };

  const conteudo = (
    <View
      style={{
        backgroundColor: hexDe(p.cartao),
        borderColor: hexDe(p.linha),
        borderWidth: painel ? 1.5 : 0,
        borderRadius: painel ? 20 : 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 18,
        maxHeight: painel ? undefined : '88%',
        flex: painel ? 1 : undefined,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconeDoEstado estado={item.estado} />
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: '800',
            color: hexDe(p.tinta),
          }}
        >
          {item.label || item.name}
        </Text>
        <TouchableOpacity
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel={t('fila.fechar')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hexDe(p.fundoBaixo),
          }}
        >
          <Ionicons name="close" size={18} color={hexDe(p.tinta)} />
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 8 }}>
        <PilulaEstado item={item} />
      </View>

      <ScrollView
        style={{ marginTop: 10 }}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {linhas.map(linha => (
          <View
            key={linha.rotulo}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 7,
              borderBottomWidth: 1,
              borderBottomColor: hexDe(p.linha) + '66',
            }}
          >
            <Text style={{ fontSize: 13, color: hexDe(p.tintaSoft) }}>
              {linha.rotulo}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 13,
                fontWeight: '600',
                color: hexDe(p.tinta),
              }}
            >
              {linha.valor}
            </Text>
          </View>
        ))}

        <Text
          style={{
            fontSize: 11,
            color: hexDe(p.tintaSoft),
            marginTop: 12,
            lineHeight: 16,
          }}
        >
          {t('fila.regras')}
        </Text>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Botao
          rotulo={t('fila.topo')}
          icone="arrow-up"
          activo={reordenavel && posicao > 1}
          onPress={() => onMover(0)}
        />
        <Botao
          rotulo={t('fila.subir')}
          icone="chevron-up"
          activo={reordenavel && posicao > 1}
          onPress={() => onMover(posicao - 2)}
        />
        <Botao
          rotulo={t('fila.descer')}
          icone="chevron-down"
          activo={reordenavel && posicao < total}
          onPress={() => onMover(posicao)}
        />
      </View>

      {onArrancar ? (
        <TouchableOpacity
          onPress={onArrancar}
          accessibilityRole="button"
          style={{
            minHeight: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hexDe(p.acentoSuave),
            borderWidth: 1.5,
            borderColor: hexDe(p.acentoTexto) + '66',
            marginTop: 10,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: hexDe(p.acentoTexto),
            }}
          >
            {t('fila.arrancarAgora')}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Botao
          rotulo={t('fila.duplicar')}
          icone="copy-outline"
          activo
          onPress={onDuplicar}
        />
        <Botao
          rotulo={t('fila.remover')}
          icone="trash-outline"
          activo
          perigo
          onPress={confirmarRemover}
        />
      </View>
    </View>
  );

  if (painel) return visivel ? conteudo : null;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={onFechar}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onFechar}
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        />
        {conteudo}
      </View>
    </Modal>
  );
};

const formatarTamanho = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
};

const Botao = ({
  rotulo,
  icone,
  activo,
  perigo,
  onPress,
}: {
  rotulo: string;
  icone: keyof typeof Ionicons.glyphMap;
  activo: boolean;
  perigo?: boolean;
  onPress: () => void;
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const cor = perigo ? hexDe(p.perigo) : hexDe(p.tinta);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!activo}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={{
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: perigo ? hexDe(p.perigo) + '66' : hexDe(p.linha),
        backgroundColor: perigo ? hexDe(p.perigo) + '12' : hexDe(p.fundoBaixo),
        opacity: activo ? 1 : 0.35,
      }}
    >
      <Ionicons name={icone} size={15} color={cor} />
      <Text
        numberOfLines={1}
        style={{ fontSize: 11, fontWeight: '700', color: cor }}
      >
        {rotulo}
      </Text>
    </TouchableOpacity>
  );
};
