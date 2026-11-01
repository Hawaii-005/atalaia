import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import {
  Disponibilidade,
  MapaControlos,
} from '../../utils/controlos/capacidades';
import { formatDuracao } from '../../utils/duracao';

type Props = {
  ficheiro?: string;
  ligada: boolean;
  disp: MapaControlos;
  temFicheiro: boolean;
  progresso?: number;
  restanteSeg?: number | null;
  onParar: () => void;
};

const motivo = (d: Disponibilidade): string =>
  d.estado === 'desactivado' ? t(`controlos.motivo.${d.motivo}`) : '';

/** Ecrã próprio da Saturn: só mostra o que existe, o resto explica-se. */
export const SecaoResina = ({
  ficheiro,
  ligada,
  disp,
  temFicheiro,
  progresso,
  restanteSeg,
  onParar,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={[estilos.titulo, { color: hexDe(p.tinta) }]}>
          {ficheiro || t('controlos.saturn.semTrabalho')}
        </Text>
        <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
          {ligada ? t('inicio.pronta') : t('inicio.semLigacao')}
        </Text>
        {typeof progresso === 'number' && progresso > 0 ? (
          <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
            {`${Math.round(progresso)}%`}
            {restanteSeg ? ` · ${formatDuracao(restanteSeg)}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={[estilos.cartao, { borderColor: hexDe(p.linha) }]}>
        <Text style={[estilos.rotulo, { color: hexDe(p.tinta) }]}>
          {t('controlos.saturn.eixoZ')}
        </Text>
        <View style={estilos.linha}>
          <Botao texto="Z +" desactivado motivo={motivo(disp.movimento)} />
          <Botao texto="Z −" desactivado motivo={motivo(disp.movimento)} />
          <Botao
            texto={t('controlos.homeZ')}
            desactivado
            motivo={motivo(disp.home)}
          />
        </View>
        <Text style={estilos.nota}>{motivo(disp.movimento)}</Text>
      </View>

      <View style={[estilos.cartao, { borderColor: hexDe(p.linha) }]}>
        <Text style={[estilos.rotulo, { color: hexDe(p.tinta) }]}>
          {t('controlos.luz')}
        </Text>
        <Text style={estilos.nota}>{motivo(disp.luz)}</Text>
      </View>

      <View style={[estilos.cartao, { borderColor: hexDe(p.linha) }]}>
        <Text style={[estilos.rotulo, { color: hexDe(p.tinta) }]}>
          {t('controlos.saturn.naoSuportado')}
        </Text>
        {[
          t('controlos.saturn.semXY'),
          t('controlos.saturn.semVentoinhas'),
          t('controlos.saturn.semTemperatura'),
        ].map(linha => (
          <Text key={linha} style={estilos.linhaLista}>
            {`· ${linha}`}
          </Text>
        ))}
      </View>

      <Text style={estilos.nota}>{t('controlos.saturn.avisoUV')}</Text>

      <TouchableOpacity
        onPress={onParar}
        disabled={!temFicheiro}
        accessibilityRole="button"
        accessibilityLabel={t('comum.parar')}
        accessibilityState={{ disabled: !temFicheiro }}
        style={[
          estilos.parar,
          {
            borderColor: hexDe(p.perigo),
            opacity: temFicheiro ? 1 : 0.4,
          },
        ]}
      >
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: hexDe(p.perigo) }}
        >
          {t('comum.parar')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const Botao = ({
  texto,
  desactivado,
  motivo: razao,
}: {
  texto: string;
  desactivado: boolean;
  motivo: string;
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${texto}. ${razao}`}
      accessibilityState={{ disabled: desactivado }}
      style={[
        estilos.botao,
        {
          borderColor: hexDe(p.linha),
          backgroundColor: hexDe(p.fundoBaixo),
          opacity: desactivado ? 0.4 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: hexDe(p.tinta) }}>
        {texto}
      </Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  titulo: { fontSize: 18, fontWeight: '700' },
  cartao: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  rotulo: { fontSize: 13, fontWeight: '700' },
  linha: { flexDirection: 'row', gap: 8 },
  botao: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nota: { fontSize: 11, color: '#8a8a8a' },
  linhaLista: { fontSize: 12, color: '#8a8a8a' },
  parar: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
