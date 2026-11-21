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
  selecionarImpressora,
  volumeDaImpressora,
  ResultadoFatiamento,
} from '../../utils/fatiador/ponte';
import {
  lerPistas,
  pistaDoTool,
  avisosAfc,
  AvisoAfc,
  Pista,
} from '../../utils/fatiador/afc';
import { usePrinterConnections } from '../../contexts/PrinterConnectionsContext';
import {
  avaliarVolume,
  caixaEnvolventeSTL,
  Dimensoes,
} from '../../utils/fatiador/volume';
import {
  analisarGcode,
  GcodeResumo,
  MotivoInvalido,
} from '../../utils/fatiador/gcode';

type Passo = 'config' | 'aFatiar' | 'resultado' | 'erro';

type Escolha = { uri: string; nome: string; tamanho: number };

const LARGURA_TOQUE = 48;

/** Chapas que o motor conhece e que a Centauri Carbon pode ter montada. */
const PLACAS = ['Textured PEI Plate', 'Cool Plate'];
const PLACA_OMISSAO = 'Textured PEI Plate';

/** Preferências de perfil: o nome exato do pack e, na falta dele, o primeiro PLA. */
const FILAMENTO_PREFERIDO = 'Generic PLA @Elegoo Centauri';
const PROCESSO_PREFERIDO = '0.20mm Standard @Elegoo CC 0.4 nozzle';

const filamentoOmissao = (lista: string[]): string =>
  lista.find(n => n === FILAMENTO_PREFERIDO) ??
  lista.find(n => /plano|PLA/i.test(n)) ??
  lista[0] ??
  '';

const processoOmissao = (lista: string[]): string =>
  lista.find(n => n === PROCESSO_PREFERIDO) ?? lista[0] ?? '';

const formatarBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

/** Janela de leitura quando o G-code é grande demais para ler inteiro. */
const JANELA = 200_000;

/**
 * Lê o G-code gerado. Um ficheiro grande só é lido nas pontas: o cabeçalho e o
 * resumo com tempo/gramas estão nos extremos, nunca a meio.
 */
const lerGcode = async (
  caminho: string
): Promise<{ texto: string; bytes: number }> => {
  // O motor devolve um caminho absoluto; o expo-file-system quer um URI.
  const uri = caminho.startsWith('file://') ? caminho : `file://${caminho}`;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const bytes = info.exists ? (info.size ?? 0) : 0;
  if (bytes <= 0) return { texto: '', bytes: 0 };
  if (bytes <= 20 * 1024 * 1024) {
    return { texto: await FileSystem.readAsStringAsync(uri), bytes };
  }
  const cabeca = await FileSystem.readAsStringAsync(uri, {
    position: 0,
    length: JANELA,
  });
  const cauda = await FileSystem.readAsStringAsync(uri, {
    position: Math.max(0, bytes - JANELA),
    length: JANELA,
  });
  return { texto: `${cabeca}\n${cauda}`, bytes };
};

const chaveDoMotivo = (motivo: MotivoInvalido): string =>
  `fatiador.falha.${motivo}`;

/** Linha rótulo → valor dos cartões do resultado [E4]. */
const LinhaResumo = ({
  rotulo,
  valor,
  cor,
  corValor,
}: {
  rotulo: string;
  valor: string;
  cor: string;
  corValor: string;
}) => (
  <View
    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
  >
    <Text style={{ color: cor }}>{rotulo}</Text>
    <Text
      style={{
        color: corValor,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'right',
      }}
    >
      {valor}
    </Text>
  </View>
);

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
  const [volume, setVolume] = useState<Dimensoes | null>(null);
  const [placa, setPlaca] = useState(PLACA_OMISSAO);
  const [filamento, setFilamento] = useState('');
  const [processo, setProcesso] = useState('');
  const [percentagem, setPercentagem] = useState(0);
  const [etapa, setEtapa] = useState('');
  const [resultado, setResultado] = useState<ResultadoFatiamento | null>(null);
  const [resumo, setResumo] = useState<GcodeResumo | null>(null);
  const { printers } = usePrinterConnections();
  const [avisos, setAvisos] = useState<AvisoAfc[]>([]);
  const [pista, setPista] = useState<Pista | null>(null);
  const [afcLido, setAfcLido] = useState(false);
  const chaveAfc = useRef('');
  const impressorasRef = useRef(printers);
  impressorasRef.current = printers;
  const [falha, setFalha] = useState<MotivoInvalido | null>(null);
  const [pedirCancelar, setPedirCancelar] = useState(false);
  const refIntervalo = useRef<ReturnType<typeof setInterval> | null>(null);

  const avaliacao = useMemo(
    () => avaliarVolume(dimensoes, volume),
    [dimensoes, volume]
  );

  // Muda a impressora no motor e recarrega os filamentos/processos que lhe são
  // compatíveis. Sem isto o motor responde pelas listas da máquina que escolheu
  // ao arrancar, e a UI mostra uma máquina com os perfis de outra.
  const aplicarImpressora = useCallback(async (nome: string) => {
    setImpressora(nome);
    await selecionarImpressora(nome);
    const l = await perfis();
    // Listas do motor: depois de `selecionarImpressora` são as compatíveis com
    // a máquina escolhida (36 filamentos e 6 processos no Cosmos AFC).
    setListas({
      impressoras: l.impressoras,
      filamentos: l.filamentos,
      processos: l.processos,
    });
    setFilamento(filamentoOmissao(l.filamentos));
    setProcesso(processoOmissao(l.processos));
    setVolume(await volumeDaImpressora(nome));
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ok = await inicializar();
      if (!vivo) return;
      if (!ok) {
        setFalhaMotor(true);
        return;
      }
      const inicial = await perfis();
      if (!vivo) return;
      const maquina =
        inicial.impressoras.find(n => n.includes('Cosmos AFC')) ??
        inicial.impressoras[0] ??
        '';
      if (!maquina) {
        setFalhaMotor(true);
        setPronto(true);
        return;
      }
      await aplicarImpressora(maquina);
      if (!vivo) return;
      setPronto(true);
    })();
    return () => {
      vivo = false;
    };
  }, [aplicarImpressora]);

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
    setResultado(null);
    setResumo(null);
    setFalha(null);
    try {
      const caminho = await prepararModelo(escolha.uri, escolha.nome);
      refIntervalo.current = setInterval(async () => {
        const prog = await progresso();
        setPercentagem(prog.percentagem);
        setEtapa(prog.etapa);
      }, 500);
      const r = await fatiar(caminho, {
        impressora,
        filamento,
        processo,
        placa,
      });
      pararSonda();
      // O motor pode dizer «sucesso» antes de o ficheiro estar escrito (foi
      // assim que apareceu «concluído — 0 B»). O ficheiro é que decide.
      let lido = { texto: '', bytes: 0 };
      let erroLeitura = '';
      if (r.sucesso) {
        try {
          lido = await lerGcode(r.gcode);
        } catch (e) {
          erroLeitura = e instanceof Error ? e.message : String(e);
        }
      }
      const analise = analisarGcode(lido.texto, lido.bytes || r.bytes);
      setResultado(
        erroLeitura
          ? { ...r, erro: t('fatiador.erroLeitura', { causa: erroLeitura }) }
          : r
      );
      setResumo(analise);
      if (r.sucesso && analise.valido) {
        setPasso('resultado');
        return;
      }
      setFalha(r.sucesso ? (analise.motivo ?? 'vazio') : null);
      setPasso('erro');
    } catch (e) {
      pararSonda();
      setResultado({
        sucesso: false,
        gcode: '',
        bytes: 0,
        erro: e instanceof Error ? e.message : String(e),
      });
      setFalha(null);
      setPasso('erro');
    }
  }, [escolha, impressora, filamento, processo, placa]);

  const cancelarAgora = useCallback(async () => {
    setPedirCancelar(false);
    await cancelar();
    pararSonda();
    setPasso('config');
  }, []);

  useEffect(() => {
    if (!resumo) {
      setAvisos([]);
      setPista(null);
      setAfcLido(false);
      chaveAfc.current = '';
      return;
    }
    // Uma leitura por (impressoras, ferramenta): o estado da impressora é
    // atualizado em ciclo e não faz sentido martelar o AFC a cada ciclo.
    const fdm = impressorasRef.current.filter(
      pr => (pr.kind ?? 'fdm') !== 'resin'
    );
    const alvo = fdm.find(pr => /centauri/i.test(pr.printerName)) ?? fdm[0];
    if (!alvo) return;
    const ip = alvo.activeIp || alvo.ipAddress;
    const chave = `${ip}|${resumo.ferramenta}`;
    if (chave === chaveAfc.current) return;
    chaveAfc.current = chave;
    let vivo = true;
    lerPistas(ip).then(pistas => {
      if (!vivo) return;
      // A pista é a que serve a ferramenta do PRINT_START; CANVAS_1 não é T0
      // por convenção, é só o nome que costuma calhar.
      const escolhida = pistaDoTool(pistas, resumo.ferramenta);
      setPista(escolhida);
      setAfcLido(pistas !== null);
      setAvisos(
        avisosAfc(escolhida, {
          material: resumo.filamento,
          bico: resumo.bico,
          mesa: resumo.mesa,
        })
      );
    });
    return () => {
      vivo = false;
    };
  }, [resumo]);

  const reiniciar = useCallback(() => {
    setResultado(null);
    setResumo(null);
    setFalha(null);
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
                  onPress={() => aplicarImpressora(nome)}
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
                {t('fatiador.filamento')} ({listas.filamentos.length})
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
                {t('fatiador.processo')} ({listas.processos.length})
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

          {/* [4b] Chapa: decide o curr_bed_type que o PRINT_START vai levar */}
          <View>
            <Text style={{ color: hexDe(p.tintaSoft), marginBottom: 6 }}>
              {t('fatiador.chapa')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {PLACAS.map(nome => (
                <TouchableOpacity
                  key={nome}
                  accessibilityRole="button"
                  onPress={() => setPlaca(nome)}
                  style={{
                    minHeight: LARGURA_TOQUE,
                    justifyContent: 'center',
                    paddingHorizontal: 14,
                    borderRadius: raio.interno,
                    borderWidth: 1,
                    borderColor:
                      nome === placa ? hexDe(p.acento) : hexDe(p.linha),
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: hexDe(p.tinta) }}>{nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

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
        {/* [9] Diagnóstico: motivo provado no ficheiro + causa do motor */}
        <Ionicons name="alert-circle" size={48} color={hexDe(p.perigo)} />
        <Text
          style={{
            color: hexDe(p.tinta),
            fontSize: 18,
            fontWeight: '700',
            marginTop: 12,
          }}
        >
          {falha ? t(chaveDoMotivo(falha)) : t('fatiador.erroTitulo')}
        </Text>
        <Text style={{ color: hexDe(p.tintaSoft), marginTop: 8 }}>
          {resultado?.erro || t('fatiador.erroDesconhecido')}
        </Text>
        {resumo && resumo.bytes > 0 ? (
          <Text style={{ color: hexDe(p.tintaMuted), marginTop: 8 }}>
            {t('fatiador.tamanhoFicheiro', {
              tamanho: formatarBytes(resumo.bytes),
            })}
          </Text>
        ) : null}
        {escolha && impressora ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={arrancar}
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
              {t('fatiador.tentarDeNovo')}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={reiniciar}
          style={{
            minHeight: LARGURA_TOQUE,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
          }}
        >
          <Text style={{ color: hexDe(p.tintaSoft) }}>
            {t('fatiador.voltarInicio')}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // [E4] Resultado — só chega aqui com o ficheiro provado (ver `analisarGcode`):
  // tamanho real, camadas, tempo, gramas e o que o PRINT_START manda fazer.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: hexDe(p.fundo) }}>
      <Header title={t('fatiador.resultadoTitulo')} onBack={reiniciar} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View
          style={{
            borderRadius: raio.interno,
            backgroundColor: hexDe(p.cartao),
            padding: 16,
            gap: 8,
          }}
        >
          <Text
            style={{ color: hexDe(p.tinta), fontSize: 26, fontWeight: '700' }}
          >
            {resumo ? formatarBytes(resumo.bytes) : '—'}
          </Text>
          <Text style={{ color: hexDe(p.tintaSoft) }}>
            {t('fatiador.e4.ficheiro', {
              nome: escolha?.nome ?? '—',
              tamanho: resumo ? formatarBytes(resumo.bytes) : '—',
            })}
          </Text>
          <LinhaResumo
            rotulo={t('fatiador.e4.camadas')}
            valor={resumo && resumo.camadas > 0 ? String(resumo.camadas) : '—'}
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
          <LinhaResumo
            rotulo={t('fatiador.e4.tempo')}
            valor={resumo?.tempo || '—'}
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
          <LinhaResumo
            rotulo={t('fatiador.e4.gramas')}
            valor={
              resumo?.gramas != null ? `${resumo.gramas.toFixed(2)} g` : '—'
            }
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
          <LinhaResumo
            rotulo={t('fatiador.filamento')}
            valor={
              [resumo?.filamento, resumo?.perfilFilamento]
                .filter(Boolean)
                .join(' · ') || '—'
            }
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
        </View>

        <View
          style={{
            borderRadius: raio.interno,
            backgroundColor: hexDe(p.cartao),
            padding: 16,
            gap: 8,
          }}
        >
          <Text style={{ color: hexDe(p.tinta), fontWeight: '600' }}>
            {t('fatiador.e4.printStart')}
          </Text>
          <LinhaResumo
            rotulo={t('fatiador.e4.bico')}
            valor={resumo?.bico != null ? `${resumo.bico} °C` : '—'}
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
          <LinhaResumo
            rotulo={t('fatiador.e4.mesa')}
            valor={resumo?.mesa != null ? `${resumo.mesa} °C` : '—'}
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
          <LinhaResumo
            rotulo={t('fatiador.e4.filamentoPrintStart')}
            valor={resumo?.filamento || '—'}
            cor={hexDe(p.tintaSoft)}
            corValor={hexDe(p.tinta)}
          />
        </View>

        {avisos.length > 0 ? (
          <View
            accessibilityRole="alert"
            style={{
              borderWidth: 2,
              borderColor: '#C62828',
              backgroundColor: hexDe(p.cartao),
              borderRadius: raio.interno,
              padding: 14,
              gap: 6,
            }}
          >
            <Text style={{ color: '#C62828', fontWeight: '700' }}>
              {t('fatiador.afcRiscoTitulo')}
            </Text>
            {avisos.map(aviso => (
              <Text key={aviso} style={{ color: '#C62828' }}>
                {t(`fatiador.afc.${aviso}`, {
                  material: pista?.material ?? '—',
                  bico: resumo?.bico ?? '—',
                  mesa: resumo?.mesa ?? '—',
                  filamento: resumo?.filamento || '—',
                })}
              </Text>
            ))}
            {pista ? (
              <Text style={{ color: hexDe(p.tintaSoft) }}>
                {t('fatiador.afc.pista', { nome: pista.nome })}
              </Text>
            ) : null}
          </View>
        ) : afcLido && resumo ? (
          <Text style={{ color: hexDe(p.tintaSoft) }}>
            {t('fatiador.afc.conforme')}
          </Text>
        ) : resumo ? (
          <Text style={{ color: hexDe(p.tintaSoft) }}>
            {t('fatiador.afcIndisponivel')}
          </Text>
        ) : null}

        <Text style={{ color: hexDe(p.tintaSoft) }}>
          {t('fatiador.avisoPerfil')}
        </Text>
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
