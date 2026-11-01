import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { ORDEM_TEMAS, TEMAS, hexDe } from '../../../theme/temas';
import { BT_ACENTO, BT_NEUTRA, TX_ACENTO } from '../../../theme/botoes';
import { IDIOMAS, t } from '../../../i18n';
import { ALVO_MINIMO, Cartao, Linha, Vazio } from '../componentes';
import { PropsSecao } from '../tipos';

const INTERVALOS = [30000, 60000, 120000, 300000];

const formatarIntervalo = (ms: number): string => {
  // O valor guardado pode ter folga de um segundo (31000 = 30 s), por isso
  // arredondamos aos 5 s para não mostrar "31 s".
  const segundos = Math.round(ms / 5000) * 5;
  return segundos < 60 ? `${segundos} s` : `${segundos / 60} min`;
};

const mesmoIntervalo = (a: number, b: number) =>
  Math.round(a / 5000) === Math.round(b / 5000);

export const SecaoAparencia = ({ ctx, visivel }: PropsSecao) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const nada =
    !visivel('aparencia.tema') &&
    !visivel('aparencia.intervalo') &&
    !visivel('aparencia.idioma');
  if (nada) return <Vazio texto={t('settings.semResultados')} />;

  const nomeIdioma =
    ctx.preferenciaIdioma === 'system'
      ? t('settings.languageSystem')
      : (IDIOMAS.find(item => item.id === ctx.preferenciaIdioma)?.nome ?? '');

  return (
    <Cartao
      titulo={t('settings.seccaoAparencia')}
      icone="color-palette-outline"
      cor={hexDe(paleta.acentoForte)}
    >
      {visivel('aparencia.tema') && (
        <View
          className={`px-4 py-3 ${visivel('aparencia.intervalo') || visivel('aparencia.idioma') ? 'border-b border-line' : ''}`}
        >
          <Text className="text-[13px] font-semibold text-ink">
            {t('settings.tema')}
          </Text>
          <Text className="text-[10px] text-ink-soft mt-0.5">
            {TEMAS[ctx.temaId]?.descricao ?? t('settings.ajudaTema')}
          </Text>
          <View className="flex-row mt-2.5" style={{ gap: 8 }}>
            {ORDEM_TEMAS.map(id => {
              const item = TEMAS[id];
              const activo = ctx.temaId === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => ctx.definirTema(id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={item.nome}
                  style={{
                    minWidth: ALVO_MINIMO,
                    minHeight: ALVO_MINIMO,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: item.amostra[0],
                      borderWidth: activo ? 2 : 1,
                      borderColor: activo
                        ? hexDe(paleta.acentoTexto)
                        : hexDe(paleta.linha),
                      padding: 5,
                      justifyContent: 'space-between',
                    }}
                  >
                    <View
                      style={{
                        height: 9,
                        borderRadius: 3,
                        backgroundColor: item.amostra[1],
                      }}
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <View
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 6,
                          backgroundColor: item.amostra[2],
                        }}
                      />
                      <View
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: item.amostra[1],
                        }}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {visivel('aparencia.intervalo') && (
        <>
          <Linha
            icone="time-outline"
            rotulo={t('settings.intervalo')}
            ajuda={t('settings.ajudaIntervalo')}
            valor={formatarIntervalo(ctx.intervaloMs)}
            ultimo={!visivel('aparencia.idioma')}
          />
          <View className="flex-row px-4 pb-3 pt-1" style={{ gap: 8 }}>
            {INTERVALOS.map(opcao => {
              const activo = mesmoIntervalo(ctx.intervaloMs, opcao);
              return (
                <TouchableOpacity
                  key={opcao}
                  onPress={() => ctx.definirIntervalo(opcao)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  accessibilityLabel={formatarIntervalo(opcao)}
                  className={`flex-1 rounded-full border py-2 items-center ${
                    activo ? BT_ACENTO : BT_NEUTRA
                  }`}
                  style={{ minHeight: ALVO_MINIMO - 8 }}
                >
                  <Text
                    className={`text-[12px] ${
                      activo ? TX_ACENTO : 'text-ink-soft font-medium'
                    }`}
                  >
                    {formatarIntervalo(opcao)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {visivel('aparencia.idioma') && (
        <Linha
          icone="language-outline"
          rotulo={t('settings.language')}
          ajuda={t('settings.languageDescription')}
          valor={nomeIdioma}
          aoTocar={ctx.abrirIdiomas}
          ultimo
        />
      )}
    </Cartao>
  );
};
