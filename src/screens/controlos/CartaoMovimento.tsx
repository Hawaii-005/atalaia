import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import { fonteNumeros } from '../../theme/tokensV6';
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
  isMoonraker?: boolean;
  onExecutarMacro?: (macro: string) => void;
};

const LADO_TECLA = 58;
const ALTURA_MINIMA = 44;

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
  isMoonraker,
  onExecutarMacro,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  const pode = (controlo: Controlo): boolean =>
    disp[controlo].estado !== 'desactivado' && !aEnviar;

  const motivo = motivoDe(disp.movimento) ?? motivoDe(disp.home);

  return (
    <View style={{ gap: 12 }}>
      {/* Título e feedback de comando */}
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

      {/* Visor digital de coordenadas (DRO) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#070A10',
          borderWidth: 1,
          borderColor: hexDe(p.linha),
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        {(['x', 'y', 'z'] as const).map((eixo, idx) => (
          <React.Fragment key={eixo}>
            {idx > 0 && (
              <View
                style={{
                  width: 1,
                  height: 24,
                  backgroundColor: hexDe(p.linha),
                }}
              />
            )}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 9.5,
                  fontWeight: '800',
                  color: hexDe(p.acentoTexto),
                  letterSpacing: 1,
                  marginBottom: 1,
                }}
              >
                {`EIXO ${eixo.toUpperCase()}`}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: hexDe(p.tinta),
                  fontFamily: fonteNumeros,
                }}
              >
                {posicao ? posicao[eixo] : '--'}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Seletor de passo */}
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
              activeOpacity={0.8}
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
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: escolhido ? '#fff' : hexDe(p.tinta),
                  fontFamily: fonteNumeros,
                }}
              >
                {rotuloPasso(mm)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Mesa de comando XY */}
      <View style={{ alignItems: 'center', gap: 6, marginVertical: 4 }}>
        <Tecla
          etiqueta="▲"
          eixoSub="Y+"
          a11y={t('controlos.moverFrente')}
          onPress={() => onMover('Y', 1)}
          activo={pode('movimento')}
          cor={hexDe(p.tinta)}
          subCor={hexDe(p.tintaMuted)}
          fundo={hexDe(p.fundoBaixo)}
          linha={hexDe(p.linha)}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Tecla
            etiqueta="◀"
            eixoSub="X-"
            a11y={t('controlos.moverEsquerda')}
            onPress={() => onMover('X', -1)}
            activo={pode('movimento')}
            cor={hexDe(p.tinta)}
            subCor={hexDe(p.tintaMuted)}
            fundo={hexDe(p.fundoBaixo)}
            linha={hexDe(p.linha)}
          />
          <TouchableOpacity
            onPress={() => onHome('XYZ')}
            disabled={!pode('home')}
            accessibilityRole="button"
            accessibilityLabel={t('controlos.homeTodos')}
            accessibilityState={{ disabled: !pode('home') }}
            activeOpacity={0.75}
            style={[
              estilos.centro,
              {
                borderColor: hexDe(p.acento),
                backgroundColor: hexDe(p.fundoBaixo),
                opacity: pode('home') ? 1 : 0.4,
              },
            ]}
          >
            <Ionicons
              name="home-outline"
              size={16}
              color={hexDe(p.acentoTexto)}
            />
            <Text
              style={{
                fontSize: 9.5,
                fontWeight: '800',
                color: hexDe(p.tinta),
                letterSpacing: 0.5,
                marginTop: 2,
              }}
            >
              HOME
            </Text>
          </TouchableOpacity>
          <Tecla
            etiqueta="▶"
            eixoSub="X+"
            a11y={t('controlos.moverDireita')}
            onPress={() => onMover('X', 1)}
            activo={pode('movimento')}
            cor={hexDe(p.tinta)}
            subCor={hexDe(p.tintaMuted)}
            fundo={hexDe(p.fundoBaixo)}
            linha={hexDe(p.linha)}
          />
        </View>
        <Tecla
          etiqueta="▼"
          eixoSub="Y-"
          a11y={t('controlos.moverTras')}
          onPress={() => onMover('Y', -1)}
          activo={pode('movimento')}
          cor={hexDe(p.tinta)}
          subCor={hexDe(p.tintaMuted)}
          fundo={hexDe(p.fundoBaixo)}
          linha={hexDe(p.linha)}
        />
      </View>

      {/* Controlo do eixo Z */}
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

      {/* Ações de Home específicas */}
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

      {/* Macros Klipper para Moonraker */}
      {isMoonraker && onExecutarMacro ? (
        <View style={{ marginTop: 4, gap: 6 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: hexDe(p.tintaSoft),
              letterSpacing: 0.5,
            }}
          >
            {t('controlos.macrosKlipper')}
          </Text>
          <View style={estilos.linha}>
            <BotaoLargo
              texto={t('controlos.macroCalibrarMesa')}
              a11y={t('controlos.macroCalibrarMesa')}
              onPress={() => onExecutarMacro('BED_MESH_CALIBRATE')}
              activo={!aEnviar}
            />
            <BotaoLargo
              texto={t('controlos.macroPararMotores')}
              a11y={t('controlos.macroPararMotores')}
              onPress={() => onExecutarMacro('M84')}
              activo={!aEnviar}
            />
            <BotaoLargo
              texto={t('controlos.macroReiniciar')}
              a11y={t('controlos.macroReiniciar')}
              onPress={() => onExecutarMacro('FIRMWARE_RESTART')}
              activo={!aEnviar}
            />
          </View>
        </View>
      ) : null}

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
  eixoSub,
  a11y,
  onPress,
  activo,
  cor,
  subCor,
  fundo,
  linha,
}: {
  etiqueta: string;
  eixoSub?: string;
  a11y: string;
  onPress: () => void;
  activo: boolean;
  cor: string;
  subCor: string;
  fundo: string;
  linha: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!activo}
    accessibilityRole="button"
    accessibilityLabel={a11y}
    accessibilityState={{ disabled: !activo }}
    activeOpacity={0.75}
    style={{
      width: LADO_TECLA,
      height: LADO_TECLA,
      borderRadius: 12,
      borderWidth: 1.2,
      borderColor: linha,
      backgroundColor: fundo,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: activo ? 1 : 0.4,
    }}
  >
    <Text style={{ fontSize: 18, fontWeight: '700', color: cor }}>
      {etiqueta}
    </Text>
    {eixoSub && (
      <Text
        style={{
          fontSize: 8.5,
          fontWeight: '800',
          color: subCor,
          letterSpacing: 0.5,
          marginTop: 1,
        }}
      >
        {eixoSub}
      </Text>
    )}
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
      activeOpacity={0.75}
      style={{
        flex: 1,
        minHeight: ALTURA_MINIMA,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: hexDe(p.linha),
        backgroundColor: hexDe(p.fundoBaixo),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        opacity: activo ? 1 : 0.4,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11.5,
          fontWeight: '700',
          color: hexDe(p.tinta),
          letterSpacing: 0.3,
        }}
      >
        {texto}
      </Text>
    </TouchableOpacity>
  );
};

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3, flex: 1 },
  resultado: { fontSize: 11, fontWeight: '600' },
  passo: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: {
    width: LADO_TECLA,
    height: LADO_TECLA,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
