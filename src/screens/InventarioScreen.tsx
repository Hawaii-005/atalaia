import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { fonteNumeros } from '../theme/tokensV6';
import { t } from '../i18n';
import {
  carregarInventario,
  adicionarGarrafa,
  adicionarRolo,
  ajustarRestante,
  ajustarRestanteMl,
  confirmarConsumo,
  custoPorGrama,
  custoPorMl,
  descartarConsumo,
  garrafaActiva,
  Inventario,
  Rolo,
  Garrafa,
  reporRolo,
  roloActivo,
  valorRestante,
} from '../utils/inventario';

const MATERIAIS = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA'];
const PESOS = [250, 500, 750, 1000];
const CORES = [
  '#F5F5F5',
  '#1B1B1B',
  '#8B7CF6',
  '#38BDF8',
  '#34D399',
  '#F97316',
  '#EAB308',
  '#F87171',
];

const formatarEuros = (valor: number) =>
  `${valor.toFixed(2).replace('.', ',')} €`;

const Barra: React.FC<{
  valor: number;
  total: number;
  cor: string;
  trilho: string;
}> = ({ valor, total, cor, trilho }) => (
  <View
    style={{
      height: 5,
      borderRadius: 3,
      backgroundColor: trilho,
      overflow: 'hidden',
      marginTop: 7,
    }}
  >
    <View
      style={{
        width: `${Math.max(0, Math.min(100, total > 0 ? (valor / total) * 100 : 0))}%`,
        height: 5,
        borderRadius: 3,
        backgroundColor: cor,
      }}
    />
  </View>
);

export const InventarioScreen = () => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const { printers } = usePrinterConnections();

  const [inventario, setInventario] = useState<Inventario>({
    rolos: [],
    garrafas: [],
    pendentes: [],
  });
  const [aCarregar, setACarregar] = useState(true);
  const [formRolo, setFormRolo] = useState<{
    printerId: string;
    repor?: Rolo;
  } | null>(null);
  const [formGarrafa, setFormGarrafa] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);

  const recarregar = useCallback(async () => {
    setInventario(await carregarInventario());
    setACarregar(false);
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const fdm = printers.filter(pr => (pr.kind ?? 'fdm') !== 'resin');
  const resina = printers.filter(pr => pr.kind === 'resin');

  const guardarRolo = async (dados: {
    nome: string;
    material: string;
    cor: string;
    pesoInicial: number;
    preco: number;
  }) => {
    if (!formRolo) return;
    setAGravar(true);
    try {
      if (formRolo.repor) {
        await reporRolo(formRolo.repor.id, {
          pesoInicial: dados.pesoInicial,
          preco: dados.preco,
        });
      } else {
        await adicionarRolo({ ...dados, printerId: formRolo.printerId });
      }
      setFormRolo(null);
      await recarregar();
    } finally {
      setAGravar(false);
    }
  };

  const guardarGarrafa = async (dados: {
    nome: string;
    cor: string;
    volumeInicial: number;
    preco: number;
  }) => {
    if (!formGarrafa) return;
    setAGravar(true);
    try {
      await adicionarGarrafa({ ...dados, printerId: formGarrafa });
      setFormGarrafa(null);
      await recarregar();
    } finally {
      setAGravar(false);
    }
  };

  const Cartao: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <View
      style={{
        backgroundColor: hexDe(p.cartao),
        borderRadius: 16,
        borderWidth: 1,
        borderColor: hexDe(p.linha),
        padding: 14,
      }}
    >
      {children}
    </View>
  );

  const Rotulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Text
      style={{
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.2,
        color: hexDe(p.tintaMuted),
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: hexDe(p.fundo) }}
    >
      <Header title={t('inv.titulo')} subtitle={t('inv.subtitulo')} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
      >
        {aCarregar ? (
          <ActivityIndicator
            color={hexDe(p.acento)}
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            {fdm.map(printer => {
              const rolo = roloActivo(inventario.rolos, printer.id);
              return (
                <Cartao key={printer.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: '700',
                        color: hexDe(p.tinta),
                      }}
                    >
                      {printer.printerName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFormRolo({ printerId: printer.id })}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: hexDe(p.acento) + '22',
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="add"
                        size={14}
                        color={hexDe(p.acentoTexto)}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: hexDe(p.acentoTexto),
                        }}
                      >
                        {t('inv.novoRolo')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!rolo ? (
                    <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
                      {t('inv.semRolo')}
                    </Text>
                  ) : (
                    <>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 9,
                            backgroundColor: rolo.cor,
                            borderWidth: 1,
                            borderColor: hexDe(p.linha),
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: hexDe(p.tinta),
                            }}
                            numberOfLines={1}
                          >
                            {rolo.nome}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: hexDe(p.tintaSoft),
                              marginTop: 1,
                            }}
                          >
                            {`${rolo.material} · ${formatarEuros(custoPorGrama(rolo) * 1000)}/kg`}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: hexDe(p.tinta),
                            fontFamily: fonteNumeros,
                          }}
                        >
                          {`${Math.round(rolo.restante)} g`}
                        </Text>
                      </View>

                      <Barra
                        valor={rolo.restante}
                        total={rolo.pesoInicial}
                        cor={
                          rolo.restante < 100 ? hexDe(p.aviso) : hexDe(p.acento)
                        }
                        trilho={hexDe(p.linha)}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          color: hexDe(p.tintaSoft),
                          marginTop: 5,
                        }}
                      >
                        {`${Math.round(rolo.restante)} / ${rolo.pesoInicial} g · ${t(
                          'inv.restanteValor',
                          {
                            valor: formatarEuros(valorRestante(rolo)),
                          }
                        )}`}
                      </Text>

                      <View
                        style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}
                      >
                        <TouchableOpacity
                          onPress={() =>
                            setFormRolo({ printerId: printer.id, repor: rolo })
                          }
                          style={{
                            flex: 1,
                            height: 34,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: hexDe(p.linha),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: hexDe(p.tinta),
                            }}
                          >
                            {t('inv.repor')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(t('inv.ajustar'), t('inv.ajustarMsg'), [
                              { text: t('comum.cancelar'), style: 'cancel' },
                              {
                                text: '+100 g',
                                onPress: () =>
                                  ajustarRestante(
                                    rolo.id,
                                    rolo.restante + 100
                                  ).then(recarregar),
                              },
                              {
                                text: '−100 g',
                                onPress: () =>
                                  ajustarRestante(
                                    rolo.id,
                                    rolo.restante - 100
                                  ).then(recarregar),
                              },
                            ])
                          }
                          style={{
                            flex: 1,
                            height: 34,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: hexDe(p.linha),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: hexDe(p.tinta),
                            }}
                          >
                            {t('inv.ajustar')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </Cartao>
              );
            })}

            {resina.map(printer => {
              const garrafa = garrafaActiva(inventario.garrafas, printer.id);
              return (
                <Cartao key={printer.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: '700',
                        color: hexDe(p.tinta),
                      }}
                    >
                      {printer.printerName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setFormGarrafa(printer.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 10,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: hexDe(p.acento) + '22',
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="add"
                        size={14}
                        color={hexDe(p.acentoTexto)}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: hexDe(p.acentoTexto),
                        }}
                      >
                        {t('inv.novaGarrafa')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {!garrafa ? (
                    <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
                      {t('inv.semGarrafa')}
                    </Text>
                  ) : (
                    <>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 9,
                            backgroundColor: garrafa.cor,
                            borderWidth: 1,
                            borderColor: hexDe(p.linha),
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: hexDe(p.tinta),
                            }}
                            numberOfLines={1}
                          >
                            {garrafa.nome}
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: hexDe(p.tintaSoft),
                              marginTop: 1,
                            }}
                          >
                            {`${formatarEuros(custoPorMl(garrafa) * 1000)}/L`}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '700',
                            color: hexDe(p.tinta),
                            fontFamily: fonteNumeros,
                          }}
                        >
                          {`${Math.round(garrafa.restante)} ml`}
                        </Text>
                      </View>
                      <Barra
                        valor={garrafa.restante}
                        total={garrafa.volumeInicial}
                        cor={hexDe(p.acento)}
                        trilho={hexDe(p.linha)}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(t('inv.ajustar'), t('inv.ajustarMsg'), [
                            { text: t('comum.cancelar'), style: 'cancel' },
                            {
                              text: '+100 ml',
                              onPress: () =>
                                ajustarRestanteMl(
                                  garrafa.id,
                                  garrafa.restante + 100
                                ).then(recarregar),
                            },
                            {
                              text: '−100 ml',
                              onPress: () =>
                                ajustarRestanteMl(
                                  garrafa.id,
                                  garrafa.restante - 100
                                ).then(recarregar),
                            },
                          ])
                        }
                        style={{
                          marginTop: 11,
                          height: 34,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: hexDe(p.linha),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: hexDe(p.tinta),
                          }}
                        >
                          {t('inv.ajustar')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Cartao>
              );
            })}

            {inventario.pendentes.length > 0 && (
              <Cartao>
                <Rotulo>{t('inv.porConfirmar')}</Rotulo>
                {inventario.pendentes.map(pend => (
                  <View
                    key={pend.id}
                    style={{
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderTopColor: hexDe(p.linha) + '77',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: hexDe(p.tinta),
                      }}
                      numberOfLines={1}
                    >
                      {pend.filename}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: hexDe(p.tintaSoft),
                        marginTop: 2,
                      }}
                    >
                      {t('inv.pendenteMsg')}
                    </Text>
                    <View
                      style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            t('inv.confirmar'),
                            t('inv.confirmarMsg'),
                            [
                              { text: t('comum.cancelar'), style: 'cancel' },
                              {
                                text: '50 g',
                                onPress: () =>
                                  confirmarConsumo(pend.id, 50).then(
                                    recarregar
                                  ),
                              },
                              {
                                text: '100 g',
                                onPress: () =>
                                  confirmarConsumo(pend.id, 100).then(
                                    recarregar
                                  ),
                              },
                              {
                                text: '200 g',
                                onPress: () =>
                                  confirmarConsumo(pend.id, 200).then(
                                    recarregar
                                  ),
                              },
                            ]
                          )
                        }
                        style={{
                          flex: 1,
                          height: 32,
                          borderRadius: 9,
                          backgroundColor: hexDe(p.acento) + '22',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: hexDe(p.acentoTexto),
                          }}
                        >
                          {t('inv.confirmar')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          descartarConsumo(pend.id).then(recarregar)
                        }
                        style={{
                          width: 90,
                          height: 32,
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: hexDe(p.linha),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: hexDe(p.tintaSoft),
                          }}
                        >
                          {t('inv.descartar')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </Cartao>
            )}

            <Text
              style={{
                fontSize: 10,
                color: hexDe(p.tintaSoft),
                lineHeight: 15,
                paddingHorizontal: 4,
              }}
            >
              {t('inv.aviso')}
            </Text>
          </>
        )}
      </ScrollView>

      <FormularioRolo
        aberto={!!formRolo}
        inicial={formRolo?.repor}
        aGravar={aGravar}
        onFechar={() => setFormRolo(null)}
        onGuardar={guardarRolo}
      />

      <FormularioGarrafa
        aberto={!!formGarrafa}
        aGravar={aGravar}
        onFechar={() => setFormGarrafa(null)}
        onGuardar={guardarGarrafa}
      />
    </SafeAreaView>
  );
};

const Campo: React.FC<{
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  numerico?: boolean;
  placeholder?: string;
}> = ({ etiqueta, valor, onChange, numerico, placeholder }) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: hexDe(p.tintaSoft),
          marginBottom: 5,
        }}
      >
        {etiqueta}
      </Text>
      <TextInput
        value={valor}
        onChangeText={onChange}
        keyboardType={numerico ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={hexDe(p.tintaMuted)}
        style={{
          height: 42,
          borderRadius: 11,
          borderWidth: 1,
          borderColor: hexDe(p.linha),
          paddingHorizontal: 12,
          color: hexDe(p.tinta),
          fontSize: 13,
        }}
      />
    </View>
  );
};

const Chip: React.FC<{
  activo: boolean;
  texto: string;
  onPress: () => void;
}> = ({ activo, texto, onPress }) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 11,
        height: 32,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: activo ? hexDe(p.acento) : hexDe(p.fundoBaixo),
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: activo ? '#fff' : hexDe(p.tintaSoft),
        }}
      >
        {texto}
      </Text>
    </TouchableOpacity>
  );
};

const Moldura: React.FC<{
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
}> = ({ aberto, titulo, onFechar, children }) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  return (
    <Modal
      visible={aberto}
      transparent
      animationType="slide"
      onRequestClose={onFechar}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(3,6,12,0.72)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: hexDe(p.fundo),
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 18,
            paddingBottom: 28,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: '700',
                color: hexDe(p.tinta),
              }}
            >
              {titulo}
            </Text>
            <TouchableOpacity
              onPress={onFechar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color={hexDe(p.tintaSoft)} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const FormularioRolo = ({
  aberto,
  inicial,
  aGravar,
  onFechar,
  onGuardar,
}: {
  aberto: boolean;
  inicial?: Rolo;
  aGravar: boolean;
  onFechar: () => void;
  onGuardar: (dados: {
    nome: string;
    material: string;
    cor: string;
    pesoInicial: number;
    preco: number;
  }) => void;
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const [nome, setNome] = useState('');
  const [material, setMaterial] = useState('PLA');
  const [cor, setCor] = useState(CORES[0]);
  const [peso, setPeso] = useState(1000);
  const [preco, setPreco] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setNome(inicial?.nome ?? '');
    setMaterial(inicial?.material ?? 'PLA');
    setCor(inicial?.cor ?? CORES[0]);
    setPeso(inicial?.pesoInicial ?? 1000);
    setPreco(inicial ? String(inicial.preco).replace('.', ',') : '');
  }, [aberto, inicial]);

  const guardar = () =>
    onGuardar({
      nome: nome.trim() || 'Filamento',
      material,
      cor,
      pesoInicial: peso,
      preco: Number(preco.replace(',', '.')) || 0,
    });

  return (
    <Moldura
      aberto={aberto}
      titulo={inicial ? t('inv.reporTitulo') : t('inv.novoRoloTitulo')}
      onFechar={onFechar}
    >
      <ScrollView
        style={{ maxHeight: 430 }}
        keyboardShouldPersistTaps="handled"
      >
        <Campo
          etiqueta={t('inv.nome')}
          valor={nome}
          onChange={setNome}
          placeholder="Elegoo PLA"
        />
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: hexDe(p.tintaSoft),
            marginBottom: 5,
          }}
        >
          {t('inv.material')}
        </Text>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}
        >
          {MATERIAIS.map(m => (
            <Chip
              key={m}
              texto={m}
              activo={material === m}
              onPress={() => setMaterial(m)}
            />
          ))}
        </View>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: hexDe(p.tintaSoft),
            marginBottom: 5,
          }}
        >
          {t('inv.cor')}
        </Text>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}
        >
          {CORES.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setCor(c)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                backgroundColor: c,
                marginRight: 7,
                marginBottom: 7,
                borderWidth: cor === c ? 2 : 1,
                borderColor: cor === c ? hexDe(p.tinta) : hexDe(p.linha),
              }}
            />
          ))}
        </View>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: hexDe(p.tintaSoft),
            marginBottom: 5,
          }}
        >
          {t('inv.peso')}
        </Text>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}
        >
          {PESOS.map(g => (
            <Chip
              key={g}
              texto={`${g} g`}
              activo={peso === g}
              onPress={() => setPeso(g)}
            />
          ))}
        </View>
        <Campo
          etiqueta={t('inv.preco')}
          valor={preco}
          onChange={setPreco}
          numerico
          placeholder="19,90"
        />
      </ScrollView>
      <TouchableOpacity
        onPress={guardar}
        disabled={aGravar}
        activeOpacity={0.85}
        style={{
          height: 46,
          borderRadius: 13,
          backgroundColor: hexDe(p.acento),
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 6,
          opacity: aGravar ? 0.6 : 1,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
          {aGravar ? t('inv.aGuardar') : t('inv.guardar')}
        </Text>
      </TouchableOpacity>
    </Moldura>
  );
};

const FormularioGarrafa = ({
  aberto,
  aGravar,
  onFechar,
  onGuardar,
}: {
  aberto: boolean;
  aGravar: boolean;
  onFechar: () => void;
  onGuardar: (dados: {
    nome: string;
    cor: string;
    volumeInicial: number;
    preco: number;
  }) => void;
}) => {
  const { tema } = useTheme();
  const p = tema.paleta;
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [volume, setVolume] = useState('1000');
  const [preco, setPreco] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setNome('');
    setCor(CORES[0]);
    setVolume('1000');
    setPreco('');
  }, [aberto]);

  return (
    <Moldura
      aberto={aberto}
      titulo={t('inv.novaGarrafaTitulo')}
      onFechar={onFechar}
    >
      <Campo
        etiqueta={t('inv.nome')}
        valor={nome}
        onChange={setNome}
        placeholder="Elegoo Water Washable"
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: hexDe(p.tintaSoft),
          marginBottom: 5,
        }}
      >
        {t('inv.cor')}
      </Text>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}
      >
        {CORES.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => setCor(c)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              backgroundColor: c,
              marginRight: 7,
              marginBottom: 7,
              borderWidth: cor === c ? 2 : 1,
              borderColor: cor === c ? hexDe(p.tinta) : hexDe(p.linha),
            }}
          />
        ))}
      </View>
      <Campo
        etiqueta={t('inv.volume')}
        valor={volume}
        onChange={setVolume}
        numerico
        placeholder="1000"
      />
      <Campo
        etiqueta={t('inv.preco')}
        valor={preco}
        onChange={setPreco}
        numerico
        placeholder="34,90"
      />
      <TouchableOpacity
        onPress={() =>
          onGuardar({
            nome: nome.trim() || 'Resina',
            cor,
            volumeInicial: Number(volume.replace(',', '.')) || 1000,
            preco: Number(preco.replace(',', '.')) || 0,
          })
        }
        disabled={aGravar}
        activeOpacity={0.85}
        style={{
          height: 46,
          borderRadius: 13,
          backgroundColor: hexDe(p.acento),
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 6,
          opacity: aGravar ? 0.6 : 1,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
          {aGravar ? t('inv.aGuardar') : t('inv.guardar')}
        </Text>
      </TouchableOpacity>
    </Moldura>
  );
};
