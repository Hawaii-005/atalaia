import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { raio } from '../../theme/tokensV6';
import { t } from '../../i18n';
import {
  cancelar,
  fatiadorDisponivel,
  fatiar,
  perfis,
  prepararModelo,
  progresso,
  inicializar,
  ResultadoFatiamento,
} from '../../utils/fatiador/ponte';
import {
  avaliarVolume,
  caixaEnvolventeSTL,
  Dimensoes,
} from '../../utils/fatiador/volume';

type Passo = 'config' | 'aFatiar' | 'resultado' | 'erro';

type Escolha = { uri: string; nome: string; tamanho: number };

const LARGURA_TOQUE = 48;

const formatarBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * [E1]–[E3] do fatiador: escolher modelo e perfil, fatiar, mostrar resultado.
 *
 * Visível apenas na edição `completa` com motor disponível; o ecã inteiro
 * devolve null caso contrário (a rota nem é registada na `lite`).
 *
 * Volume útil da máquina: lido do perfil quando o motor o expõe; enquanto não
 * houver perfis com printable_area, o ecrã avisa e deixa avançar (estado
 * `volumeIndisponivel`) em vez de bloquear com um número inventado.
 */
export const FatiadorScreen: React.FC = () => {
  const { tema } = useTheme();
  const p = tema.paleta;

  const [passo, setPasso] = useState<Passo>('config');
  const [pronto, setPronto] = useState(false);
  // true = o motor não arrancou ou não devolveu perfis; a UI explica em vez
  // de deixar o botão FATIAR desativado sem motivo.
  const [falhaMotor, setFalhaMotor] = useState(false);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [dimensoes, setDimensoes] = useState<Dimensoes | null>(null);
  const [listas, setListas] = useState({
    impressoras: [] as string[],
    filamentos: [] as string[],
    processos: [] as string[],
  });
  const [impressora, setImpressora] = useState('');
  const [filamento, setFilamento] = useState('');
  const [processo, setProcesso] = useState('');
  const [percentagem, setPercentagem] = useState(0);
  const [etapa, setEtapa] = useState('');
  const [resultado, setResultado] = useState<ResultadoFatiamento | null>(null);
  const [pedirCancelar, setPedirCancelar] = useState(false);
  const refIntervalo = useRef<ReturnType<typeof setInterval> | null>(null);

  // Volume útil: os perfis nativos do motor ainda não expõem printable_area;
  // quando passarem a expor, aqui se lê em vez de hardcodar.
  const volume: Dimensoes | null = null;

  const avaliacao = useMemo(
    () => avaliarVolume(dimensoes, volume),
    [dimensoes, volume]
  );

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ok = await inicializar();
      if (!vivo) return;
      if (!ok) {
        setFalhaMotor(true);
        return;
      }
      const l = await perfis();
      if (!vivo) return;
      setListas(l);
      if (l.impressoras.length === 0) setFalhaMotor(true);
      setImpressora(
        l.impressoras.find(n => n.includes('Cosmos AFC')) ??
          l.impressoras[0] ??
          ''
      );
      setFilamento(l.filamentos[0] ?? '');
      setProcesso(
        l.processos.find(n => n.includes('0.20mm')) ?? l.processos[0] ?? ''
      );
      setPronto(true);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (refIntervalo.current) clearInterval(refIntervalo.current);
    },
    []
  );

  const pararSonda = () => {
    if (refIntervalo.current) {
      clearInterval(refIntervalo.current);
      refIntervalo.current = null;
    }
  };

  const escolherModelo = useCallback(async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      // '*/*' e filtro por extensão: o Android não tem MIME registado para .stl,
      // por isso filtrar por tipo escondia o ficheiro no seletor.
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const f = picked.assets[0];
    try {
      const info = await FileSystem.getInfoAsync(f.uri, { size: true });
      if (!info.exists) return;
      const escolhido: Escolha = {
        uri: f.uri,
        nome: f.name,
        tamanho: info.size ?? 0,
      };
      setEscolha(escolhido);
      setDimensoes(null);
      setResultado(null);
      if (f.name.toLowerCase().endsWith('.stl')) {
        // Ler o ficheiro inteiro: a caixa envolvente só é válida com o número
        // de triângulos completo (ler só o cabeçalho dava "dimensões
        // desconhecidas" e bloqueava o botão FATIAR).
        const conteudo = await FileSystem.readAsStringAsync(f.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const dados = Uint8Array.from(atob(conteudo), c => c.charCodeAt(0));
        const caixa = caixaEnvolventeSTL(dados);
        setDimensoes(caixa?.dimensoes ?? null);
      } else {
        setDimensoes(null);
      }
    } catch {
      setEscolha(null);
      setDimensoes(null);
    }
  }, []);

  const arrancar = useCallback(async () => {
    if (!escolha || !impressora) return;
    setPasso('aFatiar');
    setPercentagem(0);
    setEtapa('');
    try {
      const caminho = await prepararModelo(escolha.uri, escolha.nome);
      refIntervalo.current = setInterval(async () => {
        const prog = await progresso();
        setPercentagem(prog.percentagem);
        setEtapa(prog.etapa);
      }, 500);
      const r = await fatiar(caminho, { impressora, filamento, processo });
      pararSonda();
      setResultado(r);
      setPasso(r.sucesso ? 'resultado' : 'erro');
    } catch (e) {
      pararSonda();
      setResultado({
        sucesso: false,
        gcode: '',
        bytes: 0,
        erro: e instanceof Error ? e.message : String(e),
      });
      setPasso('erro');
    }
  }, [escolha, impressora, filamento, processo]);

  const cancelarAgora = useCallback(async () => {
    setPedirCancelar(false);
    await cancelar();
    pararSonda();
    setPasso('config');
  }, []);

  const reiniciar = useCallback(() => {
    setResultado(null);
    setEscolha(null);
    setDimensoes(null);
    setPasso('config');
  }, []);

  // ——— Estados de ecrã ———

  if (!fatiadorDisponivel()) return null;

  if (passo === 'config') {
    const podeFatiar =
      !!escolha && pronto && !!impressora && !avaliacao.bloqueia;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: hexDe(p.fundo) }}>
        <Header title={t('fatiador.titulo')} />
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* [1] Modelo selecionado */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={escolherModelo}
            style={{
              minHeight: LARGURA_TOQUE,
              borderRadius: raio.interno,
              borderWidth: 1,
              borderColor: hexDe(p.linha),
              padding: 14,
              backgroundColor: hexDe(p.cartao),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={escolha ? 'document' : 'add-circle-outline'}
                size={22}
                color={hexDe(p.acento)}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: hexDe(p.tinta), fontWeight: '600' }}>
                  {escolha ? escolha.nome : t('fatiador.escolherModelo')}
                </Text>
                {escolha ? (
                  <Text style={{ color: hexDe(p.tintaSoft), marginTop: 2 }}>
                    {formatarBytes(escolha.tamanho)}
                    {dimensoes
                      ? ` · ${dimensoes.x.toFixed(1)} × ${dimensoes.y.toFixed(1)} × ${dimensoes.z.toFixed(1)} mm`
                      : ''}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={hexDe(p.tintaMuted)}
              />
            </View>
          </TouchableOpacity>

          {falhaMotor ? (
            <Text style={{ color: hexDe(p.perigo) }}>
              {t('fatiador.motorIndisponivel')}
            </Text>
          ) : null}

          {/* [V2] Estados do volume */}
          {escolha && avaliacao.estado !== 'cabe' ? (
            <View
              style={{
                borderRadius: raio.interno,
                padding: 12,
                backgroundColor: hexDe(avaliacao.bloqueia ? p.perigo : p.aviso),
                opacity: 0.15,
                position: 'absolute',
              }}
            >
              <Text style={{ color: hexDe(p.tinta) }}>
                {t(`fatiador.volume.${avaliacao.estado}`)}
              </Text>
            </View>
          ) : null}
          {escolha && avaliacao.estado !== 'cabe' ? (
            <Text
              style={{
                color: hexDe(avaliacao.bloqueia ? p.perigo : p.aviso),
              }}
            >
              {t(`fatiador.volume.${avaliacao.estado}`)}
            </Text>
          ) : null}

          {/* [2] Perfil de máquina */}
          {listas.impressoras.length > 0 ? (
            <View>
              <Text style={{ color: hexDe(p.tintaSoft), marginBottom: 6 }}>
                {t('fatiador.impressora')}
              </Text>
              {listas.impressoras.map(nome => (
                <TouchableOpacity
                  key={nome}
                  accessibilityRole="button"
                  onPress={() => setImpressora(nome)}
                  style={{
                    minHeight: LARGURA_TOQUE,
                    justifyContent: 'center',
                    borderRadius: raio.interno,
                    borderWidth: 1,
                    borderColor:
                      nome === impressora ? hexDe(p.acento) : hexDe(p.linha),
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: hexDe(p.tinta) }}>{nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* [4] Filamento e processo */}
          {listas.filamentos.length > 0 ? (
            <View>
              <Text style={{ color: hexDe(p.tintaSoft), marginBottom: 6 }}>
                {t('fatiador.filamento')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {listas.filamentos.map(nome => (
                  <TouchableOpacity
                    key={nome}
                    accessibilityRole="button"
                    onPress={() => setFilamento(nome)}
                    style={{
                      minHeight: LARGURA_TOQUE,
                      justifyContent: 'center',
                      paddingHorizontal: 14,
                      borderRadius: raio.interno,
                      borderWidth: 1,
                      borderColor:
                        nome === filamento ? hexDe(p.acento) : hexDe(p.linha),
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: hexDe(p.tinta) }}>{nome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {listas.processos.length > 0 ? (
            <View>
              <Text style={{ color: hexDe(p.tintaSoft), marginBottom: 6 }}>
                {t('fatiador.processo')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {listas.processos.map(nome => (
                  <TouchableOpacity
                    key={nome}
                    accessibilityRole="button"
                    onPress={() => setProcesso(nome)}
                    style={{
                      minHeight: LARGURA_TOQUE,
                      justifyContent: 'center',
                      paddingHorizontal: 14,
                      borderRadius: raio.interno,
                      borderWidth: 1,
                      borderColor:
                        nome === processo ? hexDe(p.acento) : hexDe(p.linha),
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: hexDe(p.tinta) }}>{nome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* [5] Estimativas honestas: sempre — antes do fatiamento */}
          <Text style={{ color: hexDe(p.tintaMuted) }}>
            {t('fatiador.estimativasPendentes')}
          </Text>
        </ScrollView>

        {/* [6] Fatiar */}
        <View style={{ padding: 16 }}>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!podeFatiar}
            onPress={arrancar}
            style={{
              minHeight: LARGURA_TOQUE,
              borderRadius: raio.interno,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: podeFatiar
                ? hexDe(p.acento)
                : hexDe(p.fundoBaixo),
            }}
          >
            <Text
              style={{
                color: podeFatiar ? hexDe(p.tinta) : hexDe(p.tintaMuted),
                fontWeight: '700',
              }}
            >
              {t('fatiador.fatiar')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (passo === 'aFatiar') {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: hexDe(p.fundo),
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {/* [7] Progresso + [8] cancelar com confirmação */}
        <ActivityIndicator size="large" color={hexDe(p.acento)} />
        <Text
          style={{
            color: hexDe(p.tinta),
            fontSize: 28,
            fontWeight: '700',
            marginTop: 16,
          }}
        >
          {percentagem}%
        </Text>
        {etapa ? (
          <Text style={{ color: hexDe(p.tintaSoft), marginTop: 8 }}>
            {etapa}
          </Text>
        ) : null}
        <Text
          style={{
            color: hexDe(p.tintaMuted),
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          {t('fatiador.manterAberta')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setPedirCancelar(true)}
          style={{
            minHeight: LARGURA_TOQUE,
            paddingHorizontal: 24,
            borderRadius: raio.interno,
            borderWidth: 1,
            borderColor: hexDe(p.perigo),
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 32,
          }}
        >
          <Text style={{ color: hexDe(p.perigo) }}>{t('comum.cancelar')}</Text>
        </TouchableOpacity>

        <Modal visible={pedirCancelar} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: '#00000099',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <View
              style={{
                backgroundColor: hexDe(p.cartao),
                borderRadius: raio.cartao,
                padding: 20,
                width: '100%',
              }}
            >
              <Text style={{ color: hexDe(p.tinta), fontWeight: '700' }}>
                {t('fatiador.cancelarTitulo')}
              </Text>
              <Text
                style={{
                  color: hexDe(p.tintaSoft),
                  marginTop: 8,
                  marginBottom: 16,
                }}
              >
                {t('fatiador.cancelarCorpo')}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setPedirCancelar(false)}
                  style={{ minHeight: LARGURA_TOQUE, justifyContent: 'center' }}
                >
                  <Text style={{ color: hexDe(p.acento) }}>
                    {t('fatiador.cancelarNao')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={cancelarAgora}
                  style={{ minHeight: LARGURA_TOQUE, justifyContent: 'center' }}
                >
                  <Text style={{ color: hexDe(p.perigo) }}>
                    {t('fatiador.cancelarSim')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (passo === 'erro') {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: hexDe(p.fundo),
          padding: 24,
          justifyContent: 'center',
        }}
      >
        {/* [9] Diagnóstico */}
        <Ionicons name="alert-circle" size={48} color={hexDe(p.perigo)} />
        <Text
          style={{
            color: hexDe(p.tinta),
            fontSize: 18,
            fontWeight: '700',
            marginTop: 12,
          }}
        >
          {t('fatiador.erroTitulo')}
        </Text>
        <Text style={{ color: hexDe(p.tintaSoft), marginTop: 8 }}>
          {resultado?.erro || t('fatiador.erroDesconhecido')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={reiniciar}
          style={{
            minHeight: LARGURA_TOQUE,
            borderRadius: raio.interno,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hexDe(p.acento),
            marginTop: 24,
          }}
        >
          <Text style={{ color: hexDe(p.tinta), fontWeight: '700' }}>
            {t('fatiador.voltarInicio')}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // [E4] Resultado — a vista 2D de camadas e os destinos entram no passo
  // seguinte (F2.4b); aqui ficam os dados reais e o aviso de perfil novo.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: hexDe(p.fundo) }}>
      <Header title={t('fatiador.resultadoTitulo')} onBack={reiniciar} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View
          style={{
            borderRadius: raio.interno,
            backgroundColor: hexDe(p.cartao),
            padding: 16,
          }}
        >
          <Text style={{ color: hexDe(p.tinta), fontWeight: '700' }}>
            {resultado ? formatarBytes(resultado.bytes) : '—'}
          </Text>
          <Text style={{ color: hexDe(p.tintaSoft), marginTop: 4 }}>
            {t('fatiador.avisoPerfil')}
          </Text>
        </View>
      </ScrollView>
      <View style={{ padding: 16 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={reiniciar}
          style={{
            minHeight: LARGURA_TOQUE,
            borderRadius: raio.interno,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: hexDe(p.linha),
          }}
        >
          <Text style={{ color: hexDe(p.tinta) }}>
            {t('fatiador.fatiarOutro')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
