import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { t } from '../../i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import {
  CamadasGcode,
  LIMITE_BYTES,
  alturaDaCamada,
  caminhoDaCamada,
  coresDasCamadas,
  lerCamadas,
  limitesDoObjeto,
} from '../../utils/gcode/camadas';

type Estado =
  | 'aCarregar'
  | 'pronto'
  | 'semCopia'
  | 'grande'
  | 'erro'
  | 'ocupada';

const urlDoFicheiro = (ip: string, nome: string) => {
  const limpo = nome.replace(/^\/?(local\/)?\/?/, '').replace(/^\//, '');
  return `http://${ip}:3030/local/${encodeURIComponent(limpo)}`;
};

/** Barra de camadas: arrastar e tocar. Feita à mão para não trazer dependência. */
const Deslizador = ({
  valor,
  maximo,
  onMudar,
}: {
  valor: number;
  maximo: number;
  onMudar: (v: number) => void;
}) => {
  const { tema } = useTheme();
  const [largura, setLargura] = useState(0);
  const referencia = useRef<View>(null);
  const esquerda = useRef(0);

  const limitar = useCallback(
    (xRelativo: number) => {
      if (largura <= 0 || maximo <= 1) return;
      const racio = Math.max(0, Math.min(1, xRelativo / largura));
      onMudar(Math.round(racio * (maximo - 1)));
    },
    [largura, maximo, onMudar]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evento => limitar(evento.nativeEvent.locationX),
        onPanResponderMove: (_evento, gesto) =>
          limitar(gesto.moveX - esquerda.current),
        onPanResponderRelease: () => undefined,
      }),
    [limitar]
  );

  const posicao =
    maximo > 1 && largura > 0 ? (valor / (maximo - 1)) * largura : 0;

  return (
    <View
      ref={referencia}
      onLayout={evento => {
        setLargura(evento.nativeEvent.layout.width);
        referencia.current?.measureInWindow(x => {
          esquerda.current = x;
        });
      }}
      style={{ height: 48, justifyContent: 'center' }}
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 1, max: maximo, now: valor + 1 }}
    >
      <View style={{ height: 4, borderRadius: 2 }} className="bg-line" />
      <View
        style={{
          position: 'absolute',
          left: 0,
          height: 4,
          borderRadius: 2,
          width: posicao,
          backgroundColor: hexDe(tema.paleta.acento),
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: Math.max(0, posicao - 11),
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hexDe(tema.paleta.acento),
          borderWidth: 2,
          borderColor: hexDe(tema.paleta.cartao),
        }}
      />
    </View>
  );
};

export const Camadas = ({
  printerIp,
  nome,
  mini,
  onClose,
}: {
  printerIp: string;
  nome: string;
  /** Miniatura já conhecida, mostrada enquanto o G-code é lido. */
  mini?: string | null;
  onClose: () => void;
}) => {
  const { tema } = useTheme();
  const [estado, setEstado] = useState<Estado>('aCarregar');
  const [dados, setDados] = useState<CamadasGcode | null>(null);
  const [indice, setIndice] = useState(0);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const carregar = useCallback(async () => {
    setEstado('aCarregar');
    try {
      const resposta = await fetch(urlDoFicheiro(printerIp, nome));
      if (!resposta.ok) {
        const motivo = (await resposta.text().catch(() => '')).toLowerCase();
        // Enquanto imprime, o servidor do firmware responde «device busy» e
        // não serve /local. Isso não é falta de cópia: é estar ocupada.
        if (vivo.current) {
          setEstado(motivo.includes('busy') ? 'ocupada' : 'semCopia');
        }
        return;
      }
      const texto = await resposta.text();
      if (texto.length > LIMITE_BYTES) {
        if (vivo.current) setEstado('grande');
        return;
      }
      const lido = lerCamadas(texto);
      if (!vivo.current) return;
      if (lido.camadas.length === 0) {
        setEstado('semCopia');
        return;
      }
      setDados(lido);
      // Abre na última camada, como os fatiadores.
      setIndice(lido.camadas.length - 1);
      setEstado('pronto');
    } catch {
      if (vivo.current) setEstado('erro');
    }
  }, [nome, printerIp]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const limites = useMemo(
    () => (dados ? limitesDoObjeto(dados.camadas) : null),
    [dados]
  );

  const caminho = useMemo(() => {
    if (!dados || !limites) return '';
    return caminhoDaCamada(dados.camadas[indice], limites);
  }, [dados, limites, indice]);

  const total = dados?.camadas.length ?? 0;
  const camada = dados?.camadas[indice];
  const altura = dados ? alturaDaCamada(dados.camadas, indice) : 0;

  return (
    <View className="flex-1 bg-canvas" style={{ flex: 1 }}>
      <View className="flex-row items-center px-3 py-2 border-b border-line">
        <TouchableOpacity
          onPress={onClose}
          accessibilityLabel={t('comum.voltar')}
          className="w-11 h-11 items-center justify-center"
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={hexDe(tema.paleta.tinta)}
          />
        </TouchableOpacity>
        <View className="flex-1 ml-1">
          <Text
            className="text-[13px] font-semibold text-ink"
            numberOfLines={1}
          >
            {nome.split('/').pop() ?? nome}
          </Text>
          {estado === 'pronto' && (
            <Text className="text-[11px] text-ink-muted">
              {t('camadas.contagem', { n: indice + 1, total })}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={onClose}
          accessibilityLabel={t('comum.fechar')}
          className="w-11 h-11 items-center justify-center"
        >
          <Ionicons name="close" size={22} color={hexDe(tema.paleta.tinta)} />
        </TouchableOpacity>
      </View>

      {estado === 'aCarregar' && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={hexDe(tema.paleta.acento)} />
          <Text className="text-[12px] text-ink-muted mt-3">
            {t('camadas.aCarregar')}
          </Text>
        </View>
      )}

      {estado === 'pronto' && (
        <>
          <View className="flex-1 p-4">
            <View
              className="flex-1 rounded-2xl border border-line items-center justify-center overflow-hidden"
              style={{ backgroundColor: hexDe(tema.paleta.fundoBaixo) }}
            >
              <Svg viewBox="0 0 100 100" width="100%" height="100%">
                <Path
                  d={caminho}
                  stroke={hexDe(tema.paleta.acento)}
                  strokeWidth={0.5}
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            </View>
            <View className="flex-row mt-3" style={{ gap: 8 }}>
              <Info
                rotulo={t('camadas.altura')}
                valor={`${altura.toFixed(2).replace('.', ',')} mm`}
              />
              <Info
                rotulo={t('camadas.cor')}
                valor={
                  camada?.cor === null || camada?.cor === undefined
                    ? '—'
                    : String(camada.cor + 1)
                }
              />
              <Info rotulo={t('camadas.total')} valor={String(total)} />
            </View>
            {(dados?.truncado || coresDasCamadas(dados?.camadas ?? []) > 1) && (
              <Text className="text-[11px] text-ink-muted mt-2">
                {dados?.truncado
                  ? t('camadas.truncado')
                  : t('camadas.comCores', {
                      n: coresDasCamadas(dados?.camadas ?? []),
                    })}
              </Text>
            )}
          </View>

          <View className="px-4 pb-4">
            <Deslizador valor={indice} maximo={total} onMudar={setIndice} />
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <BotaoCamada
                rotulo={t('camadas.anterior')}
                icone="chevron-back"
                desativado={indice === 0}
                onPress={() => setIndice(i => Math.max(0, i - 1))}
              />
              <BotaoCamada
                rotulo={t('camadas.seguinte')}
                icone="chevron-forward"
                desativado={indice >= total - 1}
                onPress={() => setIndice(i => Math.min(total - 1, i + 1))}
              />
            </View>
          </View>
        </>
      )}

      {(estado === 'semCopia' ||
        estado === 'grande' ||
        estado === 'erro' ||
        estado === 'ocupada') && (
        <View className="flex-1 items-center justify-center px-8">
          {mini ? (
            <Image
              source={{ uri: mini }}
              style={{ width: 160, height: 160, borderRadius: 12 }}
              resizeMode="contain"
            />
          ) : null}
          <Ionicons
            name="layers-outline"
            size={34}
            color={hexDe(tema.paleta.tintaMuted)}
          />
          <Text className="text-[13px] text-ink-soft text-center mt-3 leading-5">
            {estado === 'grande'
              ? t('camadas.grande')
              : estado === 'erro'
                ? t('camadas.erro')
                : estado === 'ocupada'
                  ? t('camadas.ocupada')
                  : t('camadas.semCopia')}
          </Text>
          <TouchableOpacity
            onPress={() => void carregar()}
            className="mt-4 px-4 py-3 rounded-xl border border-line"
            activeOpacity={0.8}
          >
            <Text className="text-[12px] font-semibold text-ink">
              {t('camadas.tentar')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const Info = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <View className="flex-1 rounded-xl border border-line px-3 py-2">
    <Text className="text-[10px] text-ink-muted uppercase tracking-wide">
      {rotulo}
    </Text>
    <Text className="text-[14px] font-semibold text-ink mt-0.5">{valor}</Text>
  </View>
);

const BotaoCamada = ({
  rotulo,
  icone,
  desativado,
  onPress,
}: {
  rotulo: string;
  icone: 'chevron-back' | 'chevron-forward';
  desativado: boolean;
  onPress: () => void;
}) => {
  const { tema } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={desativado}
      activeOpacity={0.8}
      style={{ opacity: desativado ? 0.4 : 1 }}
      className="flex-1 h-12 rounded-xl border border-line flex-row items-center justify-center"
    >
      <Ionicons name={icone} size={18} color={hexDe(tema.paleta.tinta)} />
      <Text className="text-[12px] font-semibold text-ink ml-1">{rotulo}</Text>
    </TouchableOpacity>
  );
};
