import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { hexDe } from '../theme/temas';
import { larguraMaximaConteudo } from '../theme/layout';
import { useLayout } from '../hooks/useLayout';
import { t, useIdioma } from '../i18n';
import { formatDuracao } from '../utils/duracao';
import { ItemFila, daImpressora, podeReordenar } from '../utils/fila/modelo';
import { estimarFila } from '../utils/fila/estimativas';
import { CartaoItemFila } from './fila/CartaoItemFila';
import { ListaArrastavel } from './fila/ListaArrastavel';
import { ChipsImpressora } from './fila/ChipsImpressora';
import { FaixaArranque } from './fila/FaixaArranque';
import { DetalheItem } from './fila/DetalheItem';

const ALTURA_CARTAO = 96;

/** Ecrã da fila: o que vai sair, por que ordem e quando. */
export const FilaScreen = ({ navigation }: any) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const { isTablet, largura } = useLayout();
  const {
    printers,
    fila,
    filaAuto,
    definirFilaAuto,
    moverItem,
    duplicarItem,
    removerDaFila,
    pendentesMesaLimpa,
    confirmarMesaLimpa,
    cancelarMesaLimpa,
  } = usePrinterConnections();

  const [escolhida, setEscolhida] = useState<string | undefined>();
  const printerId =
    escolhida && printers.some(imp => imp.id === escolhida)
      ? escolhida
      : printers[0]?.id;

  const impressora = printers.find(imp => imp.id === printerId);
  const itens = useMemo(
    () => (printerId ? daImpressora(fila, printerId) : []),
    [fila, printerId]
  );
  // As horas estimadas avançam com o relógio; paradas, mentiriam ao fim de
  // alguns minutos com o ecrã aberto.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const estimativa = useMemo(() => estimarFila(itens, agora), [itens, agora]);

  const [abertoId, setAbertoId] = useState<string | null>(null);
  const aberto = itens.find(item => item.id === abertoId);
  const posicao = aberto
    ? itens.findIndex(item => item.id === aberto.id) + 1
    : 0;

  useEffect(() => {
    if (abertoId && !itens.some(item => item.id === abertoId)) {
      setAbertoId(null);
    }
  }, [abertoId, itens]);

  const ligada = impressora?.connectionStatus === 'connected';
  const mesa = printerId ? pendentesMesaLimpa[printerId] : undefined;

  const limparTudo = () => {
    if (!itens.length) return;
    Alert.alert(
      t('fila.limparTudo'),
      t('fila.confirmarLimpar', { n: itens.length }),
      [
        { text: t('comum.cancelar'), style: 'cancel' },
        {
          text: t('fila.limpar'),
          style: 'destructive',
          onPress: () => itens.forEach(item => removerDaFila(item.id)),
        },
      ]
    );
  };

  const remover = (item: ItemFila) => {
    removerDaFila(item.id);
    setAbertoId(null);
  };

  const mover = (id: string, destino: number) => moverItem(id, destino);

  const totalSeg = estimativa.totalSeg;
  const totalTempo = totalSeg ? (formatDuracao(totalSeg) ?? '') : '';

  const lista = (
    <ListaArrastavel
      itens={itens}
      altura={ALTURA_CARTAO}
      podeArrastar={podeReordenar}
      onMover={mover}
    >
      {(item, indice) => (
        <CartaoItemFila
          item={item}
          posicao={indice + 1}
          estimativa={estimativa.itens[item.id]}
          altura={ALTURA_CARTAO}
          selecionado={item.id === abertoId}
          onAbrir={() => setAbertoId(item.id)}
          onSubir={() => moverItem(item.id, indice - 1)}
          onDescer={() => moverItem(item.id, indice + 1)}
          podeSubir={podeReordenar(item) && indice > 0}
          podeDescer={podeReordenar(item) && indice < itens.length - 1}
        />
      )}
    </ListaArrastavel>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: hexDe(p.fundo) }}
      edges={['top']}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('comum.voltar')}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: hexDe(p.cartao),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-back" size={20} color={hexDe(p.tinta)} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: 22, fontWeight: '800', color: hexDe(p.tinta) }}
          >
            {t('fila.titulo')}
          </Text>
          <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
            {itens.length === 1
              ? t('fila.contagemUm')
              : t('fila.contagem', { n: itens.length })}
            {totalTempo
              ? ` · ${
                  estimativa.completa
                    ? t('fila.total', { tempo: totalTempo })
                    : t('fila.totalParcial', { tempo: totalTempo })
                }`
              : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => definirFilaAuto(!filaAuto)}
          accessibilityRole="button"
          accessibilityLabel={filaAuto ? t('fila.pausar') : t('fila.retomar')}
          style={{
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: filaAuto
              ? hexDe(p.acentoTexto) + '66'
              : hexDe(p.linha),
            backgroundColor: filaAuto ? hexDe(p.acentoSuave) : hexDe(p.cartao),
          }}
        >
          <Ionicons
            name={filaAuto ? 'pause' : 'play'}
            size={15}
            color={filaAuto ? hexDe(p.acentoTexto) : hexDe(p.tinta)}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: filaAuto ? hexDe(p.acentoTexto) : hexDe(p.tinta),
            }}
          >
            {filaAuto ? t('fila.pausar') : t('fila.retomar')}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: larguraMaximaConteudo + 220,
          alignSelf: 'center',
          flexDirection: isTablet ? 'row' : 'column',
          gap: 16,
          paddingHorizontal: 16,
          paddingBottom: 16,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
        >
          <ChipsImpressora
            impressoras={printers.map(imp => ({
              id: imp.id,
              nome: imp.printerName,
              contagem: fila.filter(item => item.printerId === imp.id).length,
            }))}
            atual={printerId}
            onEscolher={setEscolhida}
            nota={t('fila.subtitulo')}
          />

          <FaixaArranque pausada={!filaAuto} ligada={!!ligada} />

          {mesa && printerId ? (
            <View
              style={{
                borderWidth: 1.5,
                borderColor: hexDe(p.aviso),
                backgroundColor: hexDe(p.aviso) + '1F',
                borderRadius: 16,
                padding: 12,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: hexDe(p.tinta),
                }}
              >
                {t('fila.mesaTitulo')}
              </Text>
              <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
                {impressora?.printerName ?? printerId} —{' '}
                {mesa.label || mesa.name}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => confirmarMesaLimpa(printerId)}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: hexDe(p.ok),
                  }}
                >
                  <Text
                    style={{ fontSize: 12, fontWeight: '800', color: '#FFF' }}
                  >
                    {t('fila.arrancarAgora')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => cancelarMesaLimpa(printerId)}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: hexDe(p.linha),
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: hexDe(p.tintaSoft),
                    }}
                  >
                    {t('comum.cancelar')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {itens.length === 0 ? (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: 40,
                paddingHorizontal: 20,
                gap: 8,
              }}
            >
              <Ionicons
                name="layers-outline"
                size={38}
                color={hexDe(p.tintaSoft)}
              />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '800',
                  color: hexDe(p.tinta),
                }}
              >
                {t('fila.vaziaTitulo')}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: hexDe(p.tintaSoft),
                  textAlign: 'center',
                }}
              >
                {t('fila.vaziaDesc')}
              </Text>
            </View>
          ) : (
            lista
          )}

          {itens.length > 0 ? (
            <TouchableOpacity
              onPress={limparTudo}
              accessibilityRole="button"
              style={{
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: hexDe(p.perigo) + '66',
                backgroundColor: hexDe(p.perigo) + '10',
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: hexDe(p.perigo),
                }}
              >
                {t('fila.limparTudo')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        {isTablet ? (
          <View style={{ width: Math.min(380, largura * 0.38) }}>
            {aberto ? (
              <DetalheItem
                painel
                visivel
                item={aberto}
                posicao={posicao}
                total={itens.length}
                estimativa={estimativa.itens[aberto.id]}
                impressora={impressora?.printerName ?? ''}
                onFechar={() => setAbertoId(null)}
                onMover={destino => mover(aberto.id, destino)}
                onDuplicar={() => {
                  duplicarItem(aberto.id);
                  setAbertoId(null);
                }}
                onRemover={() => remover(aberto)}
              />
            ) : (
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: hexDe(p.linha),
                  backgroundColor: hexDe(p.cartao),
                  padding: 18,
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: hexDe(p.tinta),
                  }}
                >
                  {t('fila.detalhe')}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: hexDe(p.tintaSoft),
                    lineHeight: 18,
                  }}
                >
                  {t('fila.regras')}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <DetalheItem
            visivel={!!aberto}
            item={aberto}
            posicao={posicao}
            total={itens.length}
            estimativa={aberto ? estimativa.itens[aberto.id] : undefined}
            impressora={impressora?.printerName ?? ''}
            onFechar={() => setAbertoId(null)}
            onMover={destino => aberto && mover(aberto.id, destino)}
            onDuplicar={() => {
              if (!aberto) return;
              duplicarItem(aberto.id);
              setAbertoId(null);
            }}
            onRemover={() => aberto && remover(aberto)}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default FilaScreen;
