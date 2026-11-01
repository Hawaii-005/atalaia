import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import {
  ESTADOS_EM_CURSO,
  ItemFila,
  MotivoCodigo,
} from '../../utils/fila/modelo';
import { EstimativaItem, formatarHora } from '../../utils/fila/estimativas';
import { formatDuracao } from '../../utils/duracao';
import { localeActual, t, useIdioma } from '../../i18n';

export const ROTULO_ESTADO: Record<ItemFila['estado'], string> = {
  pendente: 'fila.estado.pendente',
  aEnviar: 'fila.estado.aEnviar',
  aEsperaAck: 'fila.estado.aEsperaAck',
  aImprimir: 'fila.estado.aImprimir',
  concluido: 'fila.estado.concluido',
  falhou: 'fila.estado.falhou',
  cancelado: 'fila.estado.cancelado',
  bloqueado: 'fila.estado.bloqueado',
};

/** Texto do motivo; devolve `undefined` quando não há motivo guardado. */
export const textDoMotivo = (motivo?: MotivoCodigo): string | undefined =>
  motivo ? t(`fila.motivo.${motivo}`) : undefined;

export const CorDoEstado = (
  estado: ItemFila['estado']
): 'aviso' | 'perigo' | 'ok' | 'acento' | 'soft' => {
  if (estado === 'bloqueado') return 'aviso';
  if (estado === 'falhou') return 'perigo';
  if (estado === 'aImprimir') return 'ok';
  if (ESTADOS_EM_CURSO.includes(estado)) return 'acento';
  return 'soft';
};

/** Pílula do estado, com o motivo por baixo quando existe. */
export const PilulaEstado = ({ item }: { item: ItemFila }) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const cor =
    CorDoEstado(item.estado) === 'aviso'
      ? hexDe(p.aviso)
      : CorDoEstado(item.estado) === 'perigo'
        ? hexDe(p.perigo)
        : CorDoEstado(item.estado) === 'ok'
          ? hexDe(p.ok)
          : CorDoEstado(item.estado) === 'acento'
            ? hexDe(p.acentoTexto)
            : hexDe(p.tintaSoft);
  const motivo = textDoMotivo(item.motivo);
  return (
    <View>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: cor + '1F',
          borderColor: cor + '66',
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: cor }}>
          {t(ROTULO_ESTADO[item.estado])}
        </Text>
      </View>
      {motivo ? (
        <Text
          numberOfLines={1}
          style={{ fontSize: 11, color: hexDe(p.tintaSoft), marginTop: 2 }}
        >
          {motivo}
        </Text>
      ) : null}
    </View>
  );
};

/** «45m · fim 14:10», omitindo o que não se sabe. */
export const LinhaTempo = ({
  item,
  estimativa,
}: {
  item: ItemFila;
  estimativa?: EstimativaItem;
}) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const duracao = formatDuracao(item.duracaoSeg ?? estimativa?.duracaoSeg);
  const fim = formatarHora(estimativa?.fim, localeActual());
  const partes = [
    duracao || t('fila.semTempo'),
    ...(fim ? [t('fila.estimado', { hora: fim })] : []),
  ];
  return (
    <Text numberOfLines={1} style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
      {partes.join(' · ')}
    </Text>
  );
};

/** Ícone do estado, para o cabeçalho da folha de detalhe. */
export const IconeDoEstado = ({ estado }: { estado: ItemFila['estado'] }) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const cor =
    CorDoEstado(estado) === 'aviso'
      ? hexDe(p.aviso)
      : CorDoEstado(estado) === 'perigo'
        ? hexDe(p.perigo)
        : CorDoEstado(estado) === 'ok'
          ? hexDe(p.ok)
          : hexDe(p.acentoTexto);
  const nome =
    estado === 'aImprimir'
      ? 'print'
      : estado === 'falhou'
        ? 'alert-circle'
        : estado === 'bloqueado'
          ? 'lock-closed'
          : estado === 'concluido'
            ? 'checkmark-circle'
            : 'time-outline';
  return <Ionicons name={nome as any} size={18} color={cor} />;
};
