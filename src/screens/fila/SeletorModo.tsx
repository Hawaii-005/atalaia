import React from 'react';
import {
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
import { t, useIdioma } from '../../i18n';
import { CONTAGENS, ModoArranque, ModoConfig } from '../../utils/fila/modos';

type Props = {
  visivel: boolean;
  impressora: string;
  config: ModoConfig;
  onFechar: () => void;
  onGuardar: (config: ModoConfig) => void;
};

/** Escolha do modo de arranque de uma impressora. */
export const SeletorModo = ({
  visivel,
  impressora,
  config,
  onFechar,
  onGuardar,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const [modo, setModo] = React.useState<ModoArranque>(config.modo);
  const [contagem, setContagem] = React.useState<number>(config.contagemSeg);

  React.useEffect(() => {
    if (!visivel) return;
    setModo(config.modo);
    setContagem(config.contagemSeg);
  }, [visivel, config.modo, config.contagemSeg]);

  const opcoes: { id: ModoArranque; titulo: string; desc: string }[] = [
    {
      id: 'manual',
      titulo: t('fila.modoManual'),
      desc: t('fila.modoManualDesc'),
    },
    {
      id: 'confirmar',
      titulo: t('fila.modoConfirmar'),
      desc: t('fila.modoConfirmarDesc'),
    },
  ];

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
        <View
          style={{
            backgroundColor: hexDe(p.cartao),
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 18,
            gap: 12,
            maxHeight: '85%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '800',
                  color: hexDe(p.tinta),
                }}
              >
                {t('fila.modoTitulo')}
              </Text>
              <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
                {impressora}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel={t('fila.fechar')}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hexDe(p.fundoBaixo),
              }}
            >
              <Ionicons name="close" size={18} color={hexDe(p.tinta)} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ gap: 8 }}>
            {opcoes.map(opcao => {
              const activo = modo === opcao.id;
              return (
                <TouchableOpacity
                  key={opcao.id}
                  onPress={() => setModo(opcao.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  style={{
                    minHeight: 64,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: activo ? hexDe(p.acentoTexto) : hexDe(p.linha),
                    backgroundColor: activo
                      ? hexDe(p.acentoSuave)
                      : hexDe(p.fundoBaixo),
                    padding: 12,
                    gap: 3,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name={activo ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={activo ? hexDe(p.acentoTexto) : hexDe(p.tintaSoft)}
                    />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: hexDe(p.tinta),
                      }}
                    >
                      {opcao.titulo}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: hexDe(p.tintaSoft),
                      marginLeft: 26,
                      lineHeight: 17,
                    }}
                  >
                    {opcao.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {modo === 'confirmar' ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: hexDe(p.tinta),
                  }}
                >
                  {t('fila.contagemTitulo')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CONTAGENS.map(segundos => {
                    const activo = contagem === segundos;
                    return (
                      <TouchableOpacity
                        key={segundos}
                        onPress={() => setContagem(segundos)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: activo }}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: activo
                            ? hexDe(p.acentoTexto)
                            : hexDe(p.linha),
                          backgroundColor: activo
                            ? hexDe(p.acentoSuave)
                            : hexDe(p.fundoBaixo),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: '700',
                            color: activo
                              ? hexDe(p.acentoTexto)
                              : hexDe(p.tinta),
                          }}
                        >
                          {segundos}s
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    color: hexDe(p.tintaSoft),
                    lineHeight: 16,
                  }}
                >
                  {t('fila.contagemDesc')}
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: 12,
                backgroundColor: hexDe(p.fundoBaixo),
              }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={hexDe(p.tintaSoft)}
              />
              <Text
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: hexDe(p.tintaSoft),
                  lineHeight: 16,
                }}
              >
                {t('fila.modoAutomaticoIndisponivel')}
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={() =>
              onGuardar({
                modo,
                contagemSeg: contagem as ModoConfig['contagemSeg'],
              })
            }
            accessibilityRole="button"
            style={{
              minHeight: 52,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hexDe(p.acentoSuave),
              borderWidth: 1.5,
              borderColor: hexDe(p.acentoTexto) + '66',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '800',
                color: hexDe(p.acentoTexto),
              }}
            >
              {t('fila.modoGuardar')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
