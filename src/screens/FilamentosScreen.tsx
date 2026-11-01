import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { canvasSlotsCommand, CanvasTray } from '../utils/commands';
import { t, useIdioma } from '../i18n';
import { EstadoVazio } from '../ui/EstadoVazio';
import { useLayout } from '../hooks/useLayout';
import { FolhaSlot, DadosBobina } from '../components/FolhaSlot';
import {
  actualizarRolo,
  adicionarRolo,
  associarRolo,
  carregarInventario,
  desassociarRolo,
} from '../utils/inventario';
import { Spool } from '../utils/filamentos/modelo';
import {
  guardarLimiteQuaseNoFim,
  lerLimiteQuaseNoFim,
} from '../utils/filamentos/preferencias';
import { percentagemRestante } from '../utils/filamentos/operacoes';
import {
  construirVistaSlots,
  corHex,
  VistaSlot,
} from '../utils/filamentos/vista';

/**
 * Filamentos — slots do Canvas, lidos com o comando 324.
 *
 * A impressora devolve marca, tipo, cor (hex) e temperaturas de cada slot, mas
 * NÃO devolve gramas por rolo. O peso, a percentagem e o custo só aparecem
 * quando há uma bobina associada no inventário local; sem ela, o cartão diz
 * «sem bobina» em vez de inventar números.
 *
 * Tocar num slot abre a folha de detalhe, onde se editam os dados locais e se
 * associa uma bobina. Nada disto escreve no Canvas: tudo fica no telemóvel.
 */

/** Preto ou branco, o que contrastar melhor com a cor da bobina. */
const corDaTintaContraste = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '#111111' : '#ffffff';
};

export const FilamentosScreen = ({
  printerId,
  embutido,
}: { printerId?: string; embutido?: boolean } = {}) => {
  useIdioma();
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers, request } = usePrinterConnections();
  const { isTablet, colunasSlots } = useLayout();

  const fdm =
    printers.find(p => p.id === printerId) ??
    printers.find(p => (p.kind ?? 'fdm') !== 'resin');

  const [slots, setSlots] = useState<CanvasTray[] | null>(null);
  const [ativo, setAtivo] = useState<number>(-1);
  const [bobinas, setBobinas] = useState<Spool[]>([]);
  const [limite, setLimite] = useState(15);
  const [aberto, setAberto] = useState<number | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O objeto do printer muda a cada actualização de estado (1 s). Se `ler`
  // depender dele, o efeito volta a correr de segundo a segundo e o ecrã fica
  // a «carregar» sem parar. Só o id interessa, e há uma guarda contra reentrada.
  const fdmId = fdm?.id;
  const fdmRef = useRef(fdm);
  fdmRef.current = fdm;
  const aCarregarRef = useRef(false);

  const recarregarInventario = useCallback(async () => {
    const inventario = await carregarInventario();
    setBobinas(inventario.rolos);
  }, []);

  useEffect(() => {
    recarregarInventario();
    lerLimiteQuaseNoFim().then(setLimite);
  }, [recarregarInventario]);

  const ler = useCallback(async () => {
    const printer = fdmRef.current;
    if (!printer || aCarregarRef.current) return;
    aCarregarRef.current = true;
    setACarregar(true);
    setErro(null);
    try {
      // Ao abrir a app o WebSocket ainda está a nascer: uma segunda tentativa
      // resolve o primeiro pedido perdido sem o utilizador tocar em nada.
      let resposta: any;
      try {
        resposta = await request(
          printer.id,
          canvasSlotsCommand({ id: printer.id }),
          10000
        );
      } catch (primeiro) {
        await new Promise(r => setTimeout(r, 1200));
        resposta = await request(
          printer.id,
          canvasSlotsCommand({ id: printer.id }),
          10000
        );
      }
      const dados = resposta?.Data ?? resposta;
      const lista = dados?.canvas_list?.[0]?.tray_list;
      if (!Array.isArray(lista)) {
        setErro(t('filamentos.semCanvas'));
        setSlots([]);
      } else {
        setSlots(lista);
        setAtivo(
          typeof dados?.active_tray_id === 'number' ? dados.active_tray_id : -1
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      aCarregarRef.current = false;
      setACarregar(false);
    }
  }, [request]);

  useEffect(() => {
    ler();
  }, [ler, fdmId]);

  const vistas = useMemo(
    () =>
      slots && fdm
        ? construirVistaSlots(slots, bobinas, fdm.id, limite, ativo)
        : [],
    [slots, bobinas, fdm, limite, ativo]
  );

  const vistaAberta =
    aberto === null ? null : (vistas.find(v => v.trayId === aberto) ?? null);

  const guardar = async (bobinaId: string, dados: DadosBobina) => {
    await actualizarRolo(bobinaId, dados);
    await recarregarInventario();
  };

  const associar = async (bobinaId: string) => {
    if (!fdm || aberto === null) return;
    await associarRolo(bobinaId, fdm.id, aberto);
    await recarregarInventario();
  };

  const desassociar = async (bobinaId: string) => {
    await desassociarRolo(bobinaId);
    await recarregarInventario();
  };

  const criarComCanvas = async () => {
    if (!fdm || !vistaAberta) return;
    const vista = vistaAberta;
    await adicionarRolo({
      printerId: fdm.id,
      nome:
        [vista.marca, vista.material].filter(Boolean).join(' ') ||
        `Slot ${vista.rotulo}`,
      marca: vista.marca,
      material: vista.material || 'PLA',
      cor: vista.cor ?? '#808080',
      pesoInicial: 1000,
      preco: 0,
      notas: '',
      canvasSlot: vista.trayId,
    });
    await recarregarInventario();
  };

  const mudarLimite = (valor: number) => {
    setLimite(valor);
    guardarLimiteQuaseNoFim(valor).then(setLimite);
  };

  const tinta = hexDe(paleta.tinta);
  const tintaSoft = hexDe(paleta.tintaSoft);
  const cartaoFundo = hexDe(paleta.cartao);

  const CartaoSlot = ({ vista }: { vista: VistaSlot }) => {
    const cor = corHex(vista.cor, hexDe(paleta.linha));
    const alerta = vista.estado === 'quaseNoFim';
    const corAviso = alerta ? hexDe(paleta.aviso) : tintaSoft;

    const legenda = [
      vista.rotulo,
      vista.material || t('filamentos.vazio'),
      vista.bobina
        ? `${vista.restanteG} g (${vista.percentagem}%)`
        : t(
            vista.estado === 'vazio'
              ? 'filamentos.vazio'
              : 'filamentos.semBobina'
          ),
      vista.emUso ? t('filamentos.emUso') : '',
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={legenda}
        onPress={() => setAberto(vista.trayId)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 16,
          backgroundColor: cartaoFundo,
          borderWidth: vista.emUso ? 1.5 : 1,
          borderColor: vista.emUso ? hexDe(paleta.acento) : hexDe(paleta.linha),
        }}
      >
        <View
          style={{
            width: 46,
            height: 62,
            borderRadius: 10,
            backgroundColor: cor,
            borderWidth: 1,
            borderColor: hexDe(paleta.linha),
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 4,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: corDaTintaContraste(vista.cor ?? '#000000'),
            }}
          >
            {vista.rotulo}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15, fontWeight: '700', color: tinta }}
            >
              {vista.material || t('filamentos.vazio')}
            </Text>
            {vista.emUso && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: hexDe(paleta.acento) + '22',
                }}
              >
                <Ionicons
                  name="radio-button-on"
                  size={9}
                  color={hexDe(paleta.acento)}
                />
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '800',
                    color: hexDe(paleta.acento),
                  }}
                >
                  {t('filamentos.emUso').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text numberOfLines={1} style={{ fontSize: 12, color: tintaSoft }}>
            {[vista.marca, vista.corNome, vista.cor]
              .filter(Boolean)
              .join(' · ') || t('filamentos.semDadosCanvas')}
          </Text>

          {vista.minTemp && vista.maxTemp ? (
            <Text style={{ fontSize: 11, color: tintaSoft }}>
              {vista.minTemp}–{vista.maxTemp} °C
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {vista.bobina ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '800', color: tinta }}>
                {vista.percentagem}%
              </Text>
              <Text style={{ fontSize: 11, color: tintaSoft }}>
                {t('filamentos.restante', { g: String(vista.restanteG) })}
              </Text>
            </>
          ) : (
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: tintaSoft,
                textAlign: 'right',
              }}
            >
              {t(
                vista.estado === 'vazio'
                  ? 'filamentos.vazio'
                  : 'filamentos.semBobina'
              )}
            </Text>
          )}
          {alerta && (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
            >
              <Ionicons name="alert-circle" size={12} color={corAviso} />
              <Text style={{ fontSize: 10, color: corAviso }}>
                {t('filamentos.quaseNoFim')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const inventarioLateral = () => {
    const activas = bobinas.filter(
      b => !b.arquivada && b.printerId === fdm?.id
    );
    return (
      <View
        style={{
          flex: 0.85,
          gap: 8,
          padding: 14,
          borderRadius: 18,
          backgroundColor: cartaoFundo,
          borderWidth: 1,
          borderColor: hexDe(paleta.linha),
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '800', color: tinta }}>
          {t('filamentos.inventario')}
        </Text>
        {activas.length === 0 ? (
          <Text style={{ fontSize: 12, color: tintaSoft, lineHeight: 18 }}>
            {t('filamentos.semInventario')}
          </Text>
        ) : (
          activas.map(bobina => (
            <TouchableOpacity
              key={bobina.id}
              disabled={bobina.canvasSlot === undefined}
              onPress={() =>
                bobina.canvasSlot !== undefined && setAberto(bobina.canvasSlot)
              }
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: corHex(bobina.cor, hexDe(paleta.linha)),
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 12, fontWeight: '600', color: tinta }}
                >
                  {bobina.nome}
                </Text>
                <Text style={{ fontSize: 10, color: tintaSoft }}>
                  {bobina.material} · {bobina.restante} g ·{' '}
                  {percentagemRestante(bobina)}%
                  {bobina.canvasSlot !== undefined
                    ? ` · A${bobina.canvasSlot + 1}`
                    : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <Text
          style={{
            fontSize: 10,
            color: hexDe(paleta.tintaMuted),
            lineHeight: 14,
          }}
        >
          {t('filamentos.associarNota')}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }}>
      {!embutido && (
        <View
          style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}
        >
          <Text style={{ fontSize: 26, fontWeight: '700', color: tinta }}>
            {t('filamentos.titulo')}
          </Text>
          <Text style={{ fontSize: 13, color: tintaSoft, marginTop: 6 }}>
            {fdm
              ? `${fdm.printerName} · ${fdm.ipAddress}`
              : t('filamentos.semMaquina')}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 28,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={aCarregar}
            onRefresh={ler}
            tintColor={hexDe(paleta.acento)}
          />
        }
      >
        {erro && (
          <View
            style={{
              backgroundColor: cartaoFundo,
              borderRadius: 20,
              padding: 16,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: tinta }}>
              {t('filamentos.indisponivel')}
            </Text>
            <Text style={{ fontSize: 12, color: tintaSoft, lineHeight: 18 }}>
              {erro}
            </Text>
          </View>
        )}

        {!erro && slots === null && (
          <View
            style={{
              backgroundColor: cartaoFundo,
              borderRadius: 20,
              paddingVertical: 28,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={hexDe(paleta.acento)} />
            <Text style={{ fontSize: 12, color: tintaSoft, marginTop: 10 }}>
              {t('filamentos.aLer')}
            </Text>
          </View>
        )}

        {vistas.length > 0 && (
          <View
            style={{
              flexDirection: isTablet ? 'row' : 'column',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <View
              style={{
                flex: isTablet ? 1.15 : undefined,
                width: isTablet ? undefined : '100%',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              {vistas.map(vista => (
                <View
                  key={vista.trayId}
                  style={
                    colunasSlots > 1 && isTablet
                      ? { width: `${100 / colunasSlots - 2}%` }
                      : { width: '100%' }
                  }
                >
                  <CartaoSlot vista={vista} />
                </View>
              ))}
            </View>

            {isTablet && inventarioLateral()}
          </View>
        )}

        {slots && slots.length === 0 && !erro && (
          <View style={{ height: 320 }}>
            <EstadoVazio
              pose="ocioso"
              titulo={t('filamentos.semSlots')}
              descricao={t('filamentos.semSlotsNota')}
              acaoPrimaria={{ rotulo: t('filamentos.atualizar'), aoTocar: ler }}
            />
          </View>
        )}

        <TouchableOpacity
          onPress={ler}
          disabled={!fdm || aCarregar}
          style={{
            height: 48,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hexDe(paleta.acento),
            opacity: !fdm || aCarregar ? 0.5 : 1,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
            {t('filamentos.atualizar')}
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 11,
            color: hexDe(paleta.tintaMuted),
            lineHeight: 16,
          }}
        >
          {t('filamentos.notaPeso')}
        </Text>
      </ScrollView>

      <FolhaSlot
        aberta={aberto !== null}
        vista={vistaAberta}
        printerId={fdm?.id ?? ''}
        bobinas={bobinas}
        limite={limite}
        onFechar={() => setAberto(null)}
        onGuardar={guardar}
        onAssociar={associar}
        onDesassociar={desassociar}
        onCriarComCanvas={criarComCanvas}
        onLimite={mudarLimite}
      />
    </View>
  );
};
