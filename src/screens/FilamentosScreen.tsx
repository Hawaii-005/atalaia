import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { canvasSlotsCommand, CanvasTray } from '../utils/commands';
import { t } from '../i18n';

/**
 * Filamentos — lê os slots do Canvas com o comando 324.
 *
 * A impressora devolve marca, tipo, cor (hex) e temperaturas de cada slot.
 * NÃO devolve gramas por rolo: peso só existe por registo local, por isso
 * não se mostra nenhum número que a máquina não envie.
 */

/** Nome aproximado da cor, a partir do hex que a impressora envia. */
const CORES: Array<[string, [number, number, number]]> = [
  ['preto', [20, 20, 20]],
  ['branco', [245, 245, 245]],
  ['cinza', [140, 140, 140]],
  ['vermelho', [220, 40, 40]],
  ['laranja', [240, 140, 50]],
  ['amarelo', [235, 200, 60]],
  ['verde', [40, 140, 70]],
  ['azul', [50, 110, 210]],
  ['roxo', [130, 80, 200]],
  ['rosa', [230, 120, 170]],
  ['castanho', [160, 110, 60]],
];

const nomeDaCor = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  let melhor = CORES[0][0];
  let dist = Infinity;
  for (const [nome, [ar, ag, ab]] of CORES) {
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < dist) {
      dist = d;
      melhor = nome;
    }
  }
  return melhor;
};

export const FilamentosScreen = ({
  printerId,
  embutido,
}: { printerId?: string; embutido?: boolean } = {}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const { printers, request } = usePrinterConnections();

  const fdm =
    printers.find(p => p.id === printerId) ??
    printers.find(p => (p.kind ?? 'fdm') !== 'resin');
  const [slots, setSlots] = useState<CanvasTray[] | null>(null);
  const [ativo, setAtivo] = useState<number>(-1);
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O objeto do printer muda a cada actualização de estado (1 s). Se `ler`
  // depender dele, o efeito volta a correr de segundo a segundo e o ecrã fica
  // a "carregar" sem parar. Só o id interessa, e há uma guarda contra reentrada.
  const fdmId = fdm?.id;
  const fdmRef = useRef(fdm);
  fdmRef.current = fdm;
  const aCarregarRef = useRef(false);

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
        resposta = await request(printer.id, canvasSlotsCommand({ id: printer.id }), 10000);
      } catch (primeiro) {
        await new Promise(r => setTimeout(r, 1200));
        resposta = await request(printer.id, canvasSlotsCommand({ id: printer.id }), 10000);
      }
      const dados = resposta?.Data ?? resposta;
      const lista = dados?.canvas_list?.[0]?.tray_list;
      if (!Array.isArray(lista)) {
        setErro(t('filamentos.semCanvas'));
        setSlots([]);
      } else {
        setSlots(lista);
        setAtivo(typeof dados?.active_tray_id === 'number' ? dados.active_tray_id : -1);
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

  const cartao = {
    backgroundColor: hexDe(paleta.cartao),
    borderRadius: 20,
    padding: 16,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: hexDe(paleta.fundo) }}>
      {!embutido && (
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: hexDe(paleta.tinta) }}>
          {t('filamentos.titulo')}
        </Text>
        <Text style={{ fontSize: 13, color: hexDe(paleta.tintaSoft), marginTop: 6 }}>
          {fdm ? `${fdm.printerName} · ${fdm.ipAddress}` : t('filamentos.semMaquina')}
        </Text>
      </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={aCarregar} onRefresh={ler} tintColor={hexDe(paleta.acento)} />
        }
      >
        {erro && (
          <View style={[cartao, { gap: 6 }]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: hexDe(paleta.tinta) }}>
              {t('filamentos.indisponivel')}
            </Text>
            <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft), lineHeight: 18 }}>{erro}</Text>
          </View>
        )}

        {!erro && slots === null && (
          <View style={[cartao, { alignItems: 'center', paddingVertical: 28 }]}>
            <ActivityIndicator color={hexDe(paleta.acento)} />
            <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft), marginTop: 10 }}>
              {t('filamentos.aLer')}
            </Text>
          </View>
        )}

        {slots && slots.length > 0 && (
          <View style={[cartao, { gap: 8 }]}>
            {slots.map(slot => {
              const emUso = slot.tray_id === ativo;
              return (
                <View
                  key={slot.tray_id}
                  accessibilityLabel={`${t('filamentos.slot')} ${slot.tray_id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: emUso ? hexDe(paleta.acento) + '22' : 'transparent',
                    borderWidth: emUso ? 1.5 : 0,
                    borderColor: hexDe(paleta.acento),
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: slot.filament_color || hexDe(paleta.linha),
                      borderWidth: 1,
                      borderColor: hexDe(paleta.linha),
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: hexDe(paleta.tinta) }}>
                      T{slot.tray_id} · {slot.filament_type}
                      {emUso ? `  ·  ${t('filamentos.emUso')}` : ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: hexDe(paleta.tintaSoft), marginTop: 2 }}>
                      {slot.brand} · {nomeDaCor(slot.filament_color)} · {slot.min_nozzle_temp}–{slot.max_nozzle_temp} °C
                    </Text>
                  </View>
                  {slot.status === 1 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark-circle" size={16} color={hexDe(paleta.ok)} />
                      <Text style={{ fontSize: 10, color: hexDe(paleta.tintaSoft) }}>
                        {t('filamentos.carregado')}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {slots && slots.length === 0 && !erro && (
          <View style={[cartao, { gap: 6 }]}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: hexDe(paleta.tinta) }}>
              {t('filamentos.semSlots')}
            </Text>
            <Text style={{ fontSize: 12, color: hexDe(paleta.tintaSoft), lineHeight: 18 }}>
              {t('filamentos.semSlotsNota')}
            </Text>
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

        <Text style={{ fontSize: 11, color: hexDe(paleta.tintaMuted), lineHeight: 16 }}>
          {t('filamentos.notaPeso')}
        </Text>
      </ScrollView>
    </View>
  );
};
