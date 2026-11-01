import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import { MapaControlos } from '../../utils/controlos/capacidades';
import {
  CHAVE_TEMPERATURAS,
  LIMITES,
  MATERIAIS,
  Material,
  PRESETS,
  Preset,
  limitar,
  lerPresets,
  presetValido,
} from '../../utils/controlos/temperaturas';

type Props = {
  atual: { bico: number; mesa: number };
  disp: MapaControlos;
  onAplicar: (preset: Preset, material: Material | 'personalizado') => void;
  onArrefecer: () => void;
};

/** Temperaturas: predefinições editáveis e arrefecer. */
export const CartaoTemperaturas = ({
  atual,
  disp,
  onAplicar,
  onArrefecer,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  const [presets, setPresets] = useState<Record<Material, Preset>>(PRESETS);
  const [material, setMaterial] = useState<Material>('PLA');
  const [editar, setEditar] = useState(false);
  const [bico, setBico] = useState('');
  const [mesa, setMesa] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_TEMPERATURAS)
      .then(cru => {
        if (cru) setPresets(lerPresets(JSON.parse(cru)));
      })
      .catch(() => undefined);
  }, []);

  const guardar = (novo: Record<Material, Preset>) => {
    setPresets(novo);
    AsyncStorage.setItem(CHAVE_TEMPERATURAS, JSON.stringify(novo)).catch(
      () => undefined
    );
  };

  const escolhido = presets[material];
  const permitido = disp.temperatura.estado !== 'desactivado';
  const motivo =
    disp.temperatura.estado === 'desactivado'
      ? t(`controlos.motivo.${disp.temperatura.motivo}`)
      : null;

  const abrirEdicao = () => {
    setBico(String(escolhido.bico));
    setMesa(String(escolhido.mesa));
    setEditar(true);
  };

  const gravarEdicao = () => {
    const novo = presetValido({
      bico: Number(bico) || 0,
      mesa: Number(mesa) || 0,
    });
    guardar({ ...presets, [material]: novo });
    setEditar(false);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={estilos.linha}>
        <Text style={[estilos.titulo, { color: hexDe(p.tinta) }]}>
          {t('painel.temperaturas')}
        </Text>
        <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
          {t('controlos.tempAtual', {
            bico: String(Math.round(atual.bico)),
            mesa: String(Math.round(atual.mesa)),
          })}
        </Text>
      </View>

      <View style={estilos.linha}>
        {MATERIAIS.map(nome => {
          const activo = nome === material;
          return (
            <TouchableOpacity
              key={nome}
              onPress={() => {
                setMaterial(nome);
                setEditar(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={nome}
              accessibilityState={{ selected: activo }}
              style={[
                estilos.chip,
                {
                  borderColor: activo ? hexDe(p.acento) : hexDe(p.linha),
                  backgroundColor: activo
                    ? hexDe(p.acento)
                    : hexDe(p.fundoBaixo),
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: activo ? '#fff' : hexDe(p.tinta),
                }}
              >
                {nome}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: activo ? '#fff' : hexDe(p.tintaSoft),
                }}
              >
                {`${presets[nome].bico}°/${presets[nome].mesa}°`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {editar ? (
        <View style={estilos.linha}>
          <Campo
            rotulo={t('comum.bico')}
            valor={bico}
            onChange={setBico}
            max={LIMITES.bico.max}
          />
          <Campo
            rotulo={t('comum.mesa')}
            valor={mesa}
            onChange={setMesa}
            max={LIMITES.mesa.max}
          />
          <TouchableOpacity onPress={gravarEdicao} style={estilos.acao}>
            <Text
              style={{ fontSize: 12, fontWeight: '700', color: hexDe(p.tinta) }}
            >
              {t('comum.guardar')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={estilos.linha}>
          <TouchableOpacity
            onPress={abrirEdicao}
            style={estilos.acao}
            accessibilityRole="button"
            accessibilityLabel={t('controlos.editarPreset')}
          >
            <Text
              style={{ fontSize: 12, fontWeight: '600', color: hexDe(p.tinta) }}
            >
              {t('controlos.editarPreset')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={estilos.linha}>
        <TouchableOpacity
          disabled={!permitido}
          onPress={() => onAplicar(escolhido, material)}
          accessibilityRole="button"
          accessibilityLabel={t('controlos.aplicarPreset', { material })}
          accessibilityState={{ disabled: !permitido }}
          style={[
            estilos.principal,
            {
              backgroundColor: hexDe(p.acento),
              opacity: permitido ? 1 : 0.4,
            },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
            {t('controlos.aplicarPreset', { material })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!permitido}
          onPress={onArrefecer}
          accessibilityRole="button"
          accessibilityLabel={t('controlos.arrefecer')}
          accessibilityState={{ disabled: !permitido }}
          style={[
            estilos.acao,
            { borderColor: hexDe(p.linha), opacity: permitido ? 1 : 0.4 },
          ]}
        >
          <Text
            style={{ fontSize: 12, fontWeight: '600', color: hexDe(p.tinta) }}
          >
            {t('controlos.arrefecer')}
          </Text>
        </TouchableOpacity>
      </View>

      {motivo ? <Text style={estilos.motivo}>{motivo}</Text> : null}
    </View>
  );
};

const Campo = ({
  rotulo,
  valor,
  onChange,
  max,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  max: number;
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 10, color: hexDe(p.tintaSoft) }}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={texto => onChange(texto.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        accessibilityLabel={rotulo}
        style={{
          minHeight: 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: hexDe(p.linha),
          backgroundColor: hexDe(p.fundoBaixo),
          paddingHorizontal: 10,
          color: hexDe(p.tinta),
        }}
      />
      <Text
        style={{ fontSize: 9, color: hexDe(p.tintaSoft) }}
      >{`0–${max}°`}</Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: '700', flex: 1 },
  chip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  principal: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acao: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motivo: { fontSize: 11, color: '#8a8a8a' },
});

/** Normaliza um alvo antes de enviar (usado nos testes e no ecrã). */
export const alvoSeguro = (valor: string, max: number): number =>
  limitar(Number(valor) || 0, 0, max);
