import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import { Controlo, MapaControlos } from '../../utils/controlos/capacidades';
import { Slider } from './Slider';

export type VentoinhasValores = {
  model: number;
  side: number;
  chamber: number;
};

type Props = {
  ventoinhas: VentoinhasValores;
  /** Valor lido da máquina (`PrintSpeedPct`). */
  velocidade: number;
  disp: MapaControlos;
  onVentoinha: (campo: keyof VentoinhasValores, valor: number) => void;
  onVelocidade: (pct: number) => void;
};

const VELOCIDADES = [50, 100, 150, 200];

/** Velocidade e ventoinhas: envia só ao soltar e mostra o valor pedido. */
export const CartaoVentilacao = ({
  ventoinhas,
  velocidade,
  disp,
  onVentoinha,
  onVelocidade,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  const [pedidas, setPedidas] = useState<Partial<VentoinhasValores>>({});
  const [velocidadePedida, setVelocidadePedida] = useState<number | null>(null);

  // Quando a máquina confirma, o «pedido» desaparece.
  useEffect(() => {
    setPedidas(actual => {
      const proximo = { ...actual };
      let mudou = false;
      (Object.keys(proximo) as (keyof VentoinhasValores)[]).forEach(campo => {
        if (proximo[campo] === ventoinhas[campo]) {
          delete proximo[campo];
          mudou = true;
        }
      });
      return mudou ? proximo : actual;
    });
  }, [ventoinhas]);

  useEffect(() => {
    if (
      velocidadePedida !== null &&
      Math.round(velocidade) === velocidadePedida
    ) {
      setVelocidadePedida(null);
    }
  }, [velocidade, velocidadePedida]);

  const activo = (controlo: Controlo) =>
    disp[controlo].estado !== 'desactivado';

  const motivo = (controlo: Controlo) =>
    disp[controlo].estado === 'desactivado'
      ? t(`controlos.motivo.${disp[controlo].motivo}`)
      : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={estilos.linha}>
        <Text style={[estilos.titulo, { color: hexDe(p.tinta) }]}>
          {t('controlos.velocidade')}
        </Text>
        <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
          {t('controlos.velocidadeAtual', {
            pct: String(Math.round(velocidade)),
          })}
        </Text>
      </View>

      <View style={estilos.linha}>
        {VELOCIDADES.map(pct => {
          const escolhido = velocidadePedida === pct;
          const permitido = activo('velocidade');
          return (
            <TouchableOpacity
              key={pct}
              disabled={!permitido}
              onPress={() => {
                setVelocidadePedida(pct);
                onVelocidade(pct);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${pct}%`}
              accessibilityState={{ disabled: !permitido, selected: escolhido }}
              style={[
                estilos.chip,
                {
                  borderColor: escolhido ? hexDe(p.acento) : hexDe(p.linha),
                  backgroundColor: escolhido
                    ? hexDe(p.acento)
                    : hexDe(p.fundoBaixo),
                  opacity: permitido ? 1 : 0.4,
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
                {pct}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {motivo('velocidade') ? (
        <Text style={estilos.motivo}>{motivo('velocidade')}</Text>
      ) : null}

      <View style={estilos.separador} />

      <View style={estilos.linha}>
        <Text style={[estilos.titulo, { color: hexDe(p.tinta) }]}>
          {t('controlos.ventoinhas')}
        </Text>
        {Object.keys(pedidas).length > 0 ? (
          <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft) }}>
            {t('controlos.aEnviar')}
          </Text>
        ) : null}
      </View>

      {(
        [
          ['model', t('controlos.ventoinhaBico')],
          ['side', t('controlos.ventoinhaAuxiliar')],
          ['chamber', t('controlos.ventoinhaCaixa')],
        ] as [keyof VentoinhasValores, string][]
      ).map(([campo, rotulo]) => (
        <View key={campo} style={{ gap: 2 }}>
          <View style={estilos.linha}>
            <Text style={{ flex: 1, fontSize: 13, color: hexDe(p.tinta) }}>
              {rotulo}
            </Text>
            {pedidas[campo] !== undefined ? (
              <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft) }}>
                {t('controlos.pedido', { pct: String(pedidas[campo]) })}
              </Text>
            ) : null}
          </View>
          <Slider
            etiqueta={rotulo}
            valor={pedidas[campo] ?? ventoinhas[campo]}
            desactivado={!activo('ventoinhas')}
            onChange={() => undefined}
            onCommit={valor => {
              setPedidas(actual => ({ ...actual, [campo]: valor }));
              onVentoinha(campo, valor);
            }}
          />
        </View>
      ))}
      {motivo('ventoinhas') ? (
        <Text style={estilos.motivo}>{motivo('ventoinhas')}</Text>
      ) : null}
    </View>
  );
};

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: '700', flex: 1 },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separador: { height: 1, backgroundColor: 'rgba(128,128,128,0.2)' },
  motivo: { fontSize: 11, color: '#8a8a8a' },
});
