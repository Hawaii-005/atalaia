import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import {
  Controlo,
  Disponibilidade,
  MapaControlos,
} from '../../utils/controlos/capacidades';
import { PassoMm, PASSOS, rotuloPasso } from '../../utils/controlos/passo';
import { ResultadoComando } from '../../utils/controlos/resultado';

type Props = {
  posicao: { x: string; y: string; z: string } | null;
  passo: PassoMm;
  onPasso: (passo: PassoMm) => void;
  disp: MapaControlos;
  aEnviar: boolean;
  resultado: ResultadoComando | null;
  onMover: (eixo: 'X' | 'Y' | 'Z', sentido: 1 | -1) => void;
  onHome: (eixo: 'XYZ' | 'XY' | 'Z') => void;
};

const LADO_TECLA = 56;
const ALTURA_MINIMA = 48;

/** Texto do motivo, para o utilizador perceber porque está desativado. */
const motivoDe = (d: Disponibilidade): string | null => {
  if (d.estado !== 'desactivado') return null;
  return t(`controlos.motivo.${d.motivo}`);
};

/** Cartão de movimento: posição, passo, D-pad, Z e Home. */
export const CartaoMovimento = ({
  posicao,
  passo,
  onPasso,
  disp,
  aEnviar,
  resultado,
  onMover,
  onHome,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  const pode = (controlo: Controlo): boolean =>
    disp[controlo].estado !== 'desactivado' && !aEnviar;

  const motivo = motivoDe(disp.movimento) ?? motivoDe(disp.home);

  return (
    <View style={{ gap: 10 }}>
      <View style={estilos.linha}>
        <Text style={[estilos.titulo, { color: hexDe(p.tinta) }]}>
          {t('controlos.movimento')}
        </Text>
        {aEnviar ? (
          <ActivityIndicator size="small" color={hexDe(p.acento)} />
        ) : resultado ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              estilos.resultado,
              {
                color:
                  resultado.estado === 'ok'
                    ? hexDe(p.tintaSoft)
                    : hexDe(p.perigo),
              },
            ]}
          >
            {resultado.estado === 'ok'
              ? t('controlos.resultado.ok')
              : resultado.estado === 'aviso'
                ? t('controlos.resultado.precisaHome')
                : resultado.motivo === 'timeout'
                  ? t('controlos.resultado.semResposta')
                  : t('controlos.resultado.recusado', {
                      ack: String(resultado.ack ?? '?'),
                    })}
          </Text>
        ) : null}
      </View>

      <View style={estilos.linha}>
        {posicao ? (
          (['x', 'y', 'z'] as const).map(eixo => (
            <Text
              key={eixo}
              style={[estilos.posicao, { color: hexDe(p.tinta) }]}
            >
              {eixo.toUpperCase()} {posicao[eixo]}
            </Text>
          ))
        ) : (
          <Text style={{ color: hexDe(p.tintaSoft), fontSize: 12 }}>
            {t('controlos.semPosicao')}
          </Text>
        )}
      </View>

      <View style={estilos.linha}>
        {PASSOS.map(mm => {
          const escolhido = mm === passo;
          return (
            <TouchableOpacity
              key={mm}
              onPress={() => onPasso(mm)}
              accessibilityRole="button"
              accessibilityLabel={t('controlos.passoA11y', {
                passo: rotuloPasso(mm),
              })}
              accessibilityState={{ selected: escolhido }}
              style={[
                estilos.passo,
                {
                  borderColor: escolhido ? hexDe(p.acento) : hexDe(p.linha),
                  backgroundColor: escolhido
                    ? hexDe(p.acento)
                    : hexDe(p.fundoBaixo),
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: escolhido ? '#fff' : hexDe(p.tinta),
                }}
              >
                {rotuloPasso(mm)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Tecla
          etiqueta="▲"
          a11y={t('controlos.moverFrente')}
          onPress={() => onMover('Y', 1)}
          activo={pode('movimento')}
          cor={hexDe(p.tinta)}
          fundo={hexDe(p.fundoBaixo)}
          linha={hexDe(p.linha)}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Tecla
            etiqueta="◀"
            a11y={t('controlos.moverEsquerda')}
            onPress={() => onMover('X', -1)}
            activo={pode('movimento')}
            cor={hexDe(p.tinta)}
            fundo={hexDe(p.fundoBaixo)}
            linha={hexDe(p.linha)}
          />
          <TouchableOpacity
            onPress={() => onHome('XYZ')}
            disabled={!pode('home')}
            accessibilityRole="button"
            accessibilityLabel={t('controlos.homeTodos')}
            accessibilityState={{ disabled: !pode('home') }}
            style={[
              estilos.centro,
              {
                borderColor: hexDe(p.acento),
                backgroundColor: hexDe(p.fundoBaixo),
                opacity: pode('home') ? 1 : 0.4,
              },
            ]}
          >
            <Text
              style={{ fontSize: 11, fontWeight: '700', color: hexDe(p.tinta) }}
            >
              HOME
            </Text>
          </TouchableOpacity>
          <Tecla
            etiqueta="▶"
            a11y={t('controlos.moverDireita')}
            onPress={() => onMover('X', 1)}
            activo={pode('movimento')}
            cor={hexDe(p.tinta)}
            fundo={hexDe(p.fundoBaixo)}
            linha={hexDe(p.linha)}
          />
        </View>
        <Tecla
          etiqueta="▼"
          a11y={t('controlos.moverTras')}
          onPress={() => onMover('Y', -1)}
          activo={pode('movimento')}
          cor={hexDe(p.tinta)}
          fundo={hexDe(p.fundoBaixo)}
          linha={hexDe(p.linha)}
        />
      </View>

      <View style={estilos.linha}>
        <BotaoLargo
          texto="Z ▲"
          a11y={t('controlos.subirZ')}
          onPress={() => onMover('Z', 1)}
          activo={pode('movimento')}
        />
        <BotaoLargo
          texto="Z ▼"
          a11y={t('controlos.descerZ')}
          onPress={() => onMover('Z', -1)}
          activo={pode('movimento')}
        />
      </View>

      <View style={estilos.linha}>
        <BotaoLargo
          texto={t('controlos.homeTodos')}
          a11y={t('controlos.homeTodos')}
          onPress={() => onHome('XYZ')}
          activo={pode('home')}
        />
        <BotaoLargo
          texto="Home XY"
          a11y={t('controlos.homeXY')}
          onPress={() => onHome('XY')}
          activo={pode('home')}
        />
        <BotaoLargo
          texto={t('controlos.homeZ')}
          a11y={t('controlos.homeZ')}
          onPress={() => onHome('Z')}
          activo={pode('home')}
        />
      </View>

      {motivo ? (
        <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft) }}>
          {motivo}
        </Text>
      ) : null}
    </View>
  );
};

const Tecla = ({
  etiqueta,
  a11y,
  onPress,
  activo,
  cor,
  fundo,
  linha,
}: {
  etiqueta: string;
  a11y: string;
  onPress: () => void;
  activo: boolean;
  cor: string;
  fundo: string;
  linha: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!activo}
    accessibilityRole="button"
    accessibilityLabel={a11y}
    accessibilityState={{ disabled: !activo }}
    style={{
      width: LADO_TECLA,
      height: LADO_TECLA,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: linha,
      backgroundColor: fundo,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: activo ? 1 : 0.4,
    }}
  >
    <Text style={{ fontSize: 18, color: cor }}>{etiqueta}</Text>
  </TouchableOpacity>
);

const BotaoLargo = ({
  texto,
  a11y,
  onPress,
  activo,
}: {
  texto: string;
  a11y: string;
  onPress: () => void;
  activo: boolean;
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!activo}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !activo }}
      style={{
        flex: 1,
        minHeight: ALTURA_MINIMA,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: hexDe(p.linha),
        backgroundColor: hexDe(p.fundoBaixo),
        alignItems: 'center',
        justifyContent: 'center',
        opacity: activo ? 1 : 0.4,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: hexDe(p.tinta) }}>
        {texto}
      </Text>
    </TouchableOpacity>
  );
};

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: '700', flex: 1 },
  resultado: { fontSize: 11, fontWeight: '600' },
  posicao: { fontSize: 12, fontWeight: '600' },
  passo: {
    flex: 1,
    minHeight: ALTURA_MINIMA,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: {
    width: LADO_TECLA,
    height: LADO_TECLA,
    borderRadius: LADO_TECLA / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
