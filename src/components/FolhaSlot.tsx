import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { t, useIdioma } from '../i18n';
import { euros } from '../utils/precos';
import { useLayout } from '../hooks/useLayout';
import { Spool } from '../utils/filamentos/modelo';
import { percentagemRestante } from '../utils/filamentos/operacoes';
import { VistaSlot, corHex } from '../utils/filamentos/vista';
import { LIMITE_MAX, LIMITE_MIN } from '../utils/filamentos/preferencias';

export interface DadosBobina {
  nome: string;
  marca: string;
  preco: number;
  pesoInicial: number;
  restante: number;
  notas: string;
}

interface Props {
  aberta: boolean;
  vista: VistaSlot | null;
  /** Impressora dona dos slots — para filtrar o inventário certo. */
  printerId: string;
  bobinas: Spool[];
  limite: number;
  onFechar: () => void;
  onGuardar: (bobinaId: string, dados: DadosBobina) => Promise<void>;
  onAssociar: (bobinaId: string) => Promise<void>;
  onDesassociar: (bobinaId: string) => Promise<void>;
  onCriarComCanvas: () => Promise<void>;
  onLimite: (limite: number) => void;
}

const numero = (texto: string, porOmissao: number): number => {
  if (!texto.trim()) return porOmissao;
  const n = Number(texto.replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : porOmissao;
};

/**
 * Folha de detalhe de um slot.
 *
 * Mostra sempre o que veio do Canvas (só de leitura) e por baixo, separado, o
 * que é local: a bobina associada e os campos que o utilizador pode editar.
 * No telemóvel ocupa o ecrã todo; no tablet é um painel centrado.
 */
export const FolhaSlot = ({
  aberta,
  vista,
  printerId,
  bobinas,
  limite,
  onFechar,
  onGuardar,
  onAssociar,
  onDesassociar,
  onCriarComCanvas,
  onLimite,
}: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const { isTablet } = useLayout();

  const bobina = vista?.bobina;
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [preco, setPreco] = useState('');
  const [pesoInicial, setPesoInicial] = useState('');
  const [restante, setRestante] = useState('');
  const [notas, setNotas] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!aberta || !vista) return;
    setNome(bobina?.nome ?? '');
    setMarca(bobina?.marca ?? '');
    setPreco(bobina ? String(bobina.preco).replace('.', ',') : '');
    setPesoInicial(bobina ? String(bobina.pesoInicial) : '');
    setRestante(bobina ? String(bobina.restante) : '');
    setNotas(bobina?.notas ?? '');
  }, [aberta, vista, bobina]);

  if (!vista) return null;

  const cor = corHex(vista.cor, hexDe(p.linha));
  const tinta = hexDe(p.tinta);
  const tintaSoft = hexDe(p.tintaSoft);
  const cartaoFundo = hexDe(p.cartao);

  const comErro = async (acao: () => Promise<void>): Promise<boolean> => {
    setOcupado(true);
    try {
      await acao();
      return true;
    } catch (erro) {
      Alert.alert(
        t('filamentos.erroGuardar'),
        erro instanceof Error ? erro.message : String(erro)
      );
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const guardar = () =>
    comErro(async () => {
      if (!bobina) return;
      const inicial = numero(pesoInicial, bobina.pesoInicial);
      await onGuardar(bobina.id, {
        nome: nome.trim() || bobina.nome,
        marca: marca.trim(),
        preco: numero(preco, bobina.preco),
        pesoInicial: inicial,
        restante: Math.min(numero(restante, inicial), inicial),
        notas: notas.trim(),
      });
      onFechar();
    });

  const etiquetaEstado =
    vista.estado === 'quaseNoFim'
      ? t('filamentos.quaseNoFim')
      : vista.estado === 'ok'
        ? t('filamentos.carregado')
        : vista.estado === 'semBobina'
          ? t('filamentos.semBobina')
          : t('filamentos.vazio');

  const corEstado =
    vista.estado === 'quaseNoFim'
      ? hexDe(p.aviso)
      : vista.estado === 'ok'
        ? hexDe(p.ok)
        : tintaSoft;

  const campo = ({
    rotulo,
    valor,
    aoMudar,
    teclado,
    multilinha,
  }: {
    rotulo: string;
    valor: string;
    aoMudar: (v: string) => void;
    teclado?: 'default' | 'decimal-pad' | 'numeric';
    multilinha?: boolean;
  }) => (
    <View style={{ marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: tintaSoft,
          marginBottom: 5,
        }}
      >
        {rotulo}
      </Text>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        keyboardType={teclado ?? 'default'}
        multiline={multilinha}
        placeholderTextColor={hexDe(p.tintaMuted)}
        style={{
          minHeight: multilinha ? 64 : 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: hexDe(p.linha),
          backgroundColor: hexDe(p.fundo),
          color: tinta,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          textAlignVertical: multilinha ? 'top' : 'center',
        }}
      />
    </View>
  );

  const linha = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 5,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 13, color: tintaSoft }}>{rotulo}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: tinta,
          flexShrink: 1,
          textAlign: 'right',
        }}
      >
        {valor}
      </Text>
    </View>
  );

  const outras = bobinas.filter(
    item =>
      !item.arquivada && item.printerId === printerId && item.id !== bobina?.id
  );

  const corpo = (
    <View
      style={
        isTablet
          ? {
              width: 560,
              maxWidth: '92%',
              maxHeight: '86%',
              backgroundColor: cartaoFundo,
              borderRadius: 28,
              overflow: 'hidden',
            }
          : { flex: 1, backgroundColor: hexDe(p.fundo) }
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 18,
          paddingTop: isTablet ? 18 : 52,
          paddingBottom: 12,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: cor,
            borderWidth: 1,
            borderColor: hexDe(p.linha),
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: tinta }}>
            {vista.rotulo}
            {vista.material ? ` · ${vista.material}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {vista.estado === 'quaseNoFim' && (
              <Ionicons name="alert-circle" size={13} color={corEstado} />
            )}
            {vista.emUso && (
              <Ionicons name="radio-button-on" size={12} color={corEstado} />
            )}
            <Text style={{ fontSize: 12, color: corEstado, fontWeight: '700' }}>
              {etiquetaEstado}
              {vista.corNome ? ` · ${vista.corNome}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onFechar}
          accessibilityLabel={t('filamentos.fechar')}
          style={{ padding: 8 }}
        >
          <Ionicons name="close" size={22} color={tintaSoft} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1,
            color: tintaSoft,
            marginTop: 4,
            marginBottom: 8,
          }}
        >
          {t('filamentos.doCanvas').toUpperCase()}
        </Text>

        {vista.material || vista.marca || vista.cor ? (
          <View
            style={{
              backgroundColor: cartaoFundo,
              borderWidth: isTablet ? 1 : 0,
              borderColor: hexDe(p.linha),
              borderRadius: 14,
              padding: 12,
            }}
          >
            {!!vista.nome &&
              linha({ rotulo: t('inv.nome'), valor: vista.nome })}
            {linha({ rotulo: t('inv.material'), valor: vista.material || '—' })}
            {linha({
              rotulo: t('filamentos.marca'),
              valor: vista.marca || '—',
            })}
            {linha({
              rotulo: t('inv.cor'),
              valor: vista.cor ? `${vista.corNome || '—'} · ${vista.cor}` : '—',
            })}
            {linha({
              rotulo: t('filamentos.temperaturas'),
              valor:
                vista.minTemp && vista.maxTemp
                  ? `${vista.minTemp}–${vista.maxTemp} °C`
                  : '—',
            })}
            {vista.carregado &&
              linha({ rotulo: t('filamentos.carregado'), valor: '✓' })}
          </View>
        ) : (
          <Text style={{ fontSize: 13, color: tintaSoft, lineHeight: 19 }}>
            {t('filamentos.semDadosCanvas')}
          </Text>
        )}

        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1,
            color: tintaSoft,
            marginTop: 20,
            marginBottom: 8,
          }}
        >
          {t('filamentos.locais').toUpperCase()}
        </Text>

        {bobina ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 13, color: tintaSoft }}>
                {t('filamentos.restante', { g: String(bobina.restante) })}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: tinta }}>
                {euros(vista.valorRestante ?? 0)}
              </Text>
            </View>

            {campo({ rotulo: t('inv.nome'), valor: nome, aoMudar: setNome })}
            {campo({
              rotulo: t('filamentos.marca'),
              valor: marca,
              aoMudar: setMarca,
            })}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                {campo({
                  rotulo: t('inv.preco'),
                  valor: preco,
                  aoMudar: setPreco,
                  teclado: 'decimal-pad',
                })}
              </View>
              <View style={{ flex: 1 }}>
                {campo({
                  rotulo: t('inv.peso'),
                  valor: pesoInicial,
                  aoMudar: setPesoInicial,
                  teclado: 'numeric',
                })}
              </View>
            </View>
            {campo({
              rotulo: t('filamentos.pesoRestante'),
              valor: restante,
              aoMudar: setRestante,
              teclado: 'decimal-pad',
            })}
            {campo({
              rotulo: t('filamentos.notas'),
              valor: notas,
              aoMudar: setNotas,
              multilinha: true,
            })}

            <TouchableOpacity
              onPress={guardar}
              disabled={ocupado}
              style={{
                height: 46,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: hexDe(p.acento),
                opacity: ocupado ? 0.6 : 1,
                marginTop: 4,
              }}
            >
              {ocupado ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}
                >
                  {t('inv.guardar')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                comErro(() => onDesassociar(bobina.id)).then(
                  ok => ok && onFechar()
                )
              }
              disabled={ocupado}
              style={{
                height: 42,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: hexDe(p.linha),
                marginTop: 10,
              }}
            >
              <Text style={{ fontSize: 14, color: tintaSoft }}>
                {t('filamentos.desassociar')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text
              style={{
                fontSize: 13,
                color: tintaSoft,
                lineHeight: 19,
                marginBottom: 12,
              }}
            >
              {t('filamentos.slotVazioNota')}
            </Text>

            {vista.material || vista.cor ? (
              <TouchableOpacity
                onPress={() =>
                  comErro(onCriarComCanvas).then(ok => ok && onFechar())
                }
                disabled={ocupado}
                style={{
                  height: 46,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hexDe(p.acento),
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}
                >
                  {t('filamentos.criarComCanvas')}
                </Text>
              </TouchableOpacity>
            ) : null}

            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: tintaSoft,
                marginBottom: 8,
              }}
            >
              {t('filamentos.associar')}
            </Text>

            {outras.length === 0 ? (
              <Text style={{ fontSize: 13, color: tintaSoft }}>
                {t('filamentos.semInventario')}
              </Text>
            ) : (
              outras.map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() =>
                    comErro(() => onAssociar(item.id)).then(
                      ok => ok && onFechar()
                    )
                  }
                  disabled={ocupado}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: cartaoFundo,
                    borderWidth: 1,
                    borderColor: hexDe(p.linha),
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: corHex(item.cor, hexDe(p.linha)),
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: tinta,
                      }}
                    >
                      {item.nome}
                    </Text>
                    <Text style={{ fontSize: 11, color: tintaSoft }}>
                      {item.material} · {percentagemRestante(item)}% ·{' '}
                      {item.restante} g
                      {item.canvasSlot !== undefined
                        ? ` · A${item.canvasSlot + 1}`
                        : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={hexDe(p.acento)}
                  />
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginTop: 22,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: hexDe(p.linha),
          }}
        >
          <Ionicons name="notifications-outline" size={16} color={tintaSoft} />
          <Text style={{ flex: 1, fontSize: 13, color: tintaSoft }}>
            {t('filamentos.limite', { n: limite })}
          </Text>
          <TouchableOpacity
            onPress={() => onLimite(Math.max(LIMITE_MIN, limite - 5))}
            accessibilityLabel="-5%"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: hexDe(p.linha),
            }}
          >
            <Ionicons name="remove" size={18} color={tinta} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onLimite(Math.min(LIMITE_MAX, limite + 5))}
            accessibilityLabel="+5%"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: hexDe(p.linha),
            }}
          >
            <Ionicons name="add" size={18} color={tinta} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  if (!isTablet) {
    return (
      <Modal
        visible={aberta}
        animationType="slide"
        onRequestClose={onFechar}
        statusBarTranslucent
      >
        {corpo}
      </Modal>
    );
  }

  return (
    <Modal
      visible={aberta}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <Pressable
        onPress={onFechar}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Pressable onPress={() => {}}>{corpo}</Pressable>
      </Pressable>
    </Modal>
  );
};
