import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { Printer } from '../types';
import { t, useIdioma } from '../i18n';

interface LogItem {
  id: string;
  message: string;
  time: number;
  type: 'command' | 'response' | 'error';
}

const MACROS_RAPIDAS = [
  { label: 'G28 (Home)', cmd: 'G28' },
  { label: 'M84 (Desligar Motores)', cmd: 'M84' },
  { label: 'BED_MESH_CALIBRATE', cmd: 'BED_MESH_CALIBRATE' },
  { label: 'LANE_UNLOAD', cmd: 'LANE_UNLOAD' },
  { label: 'M106 S255 (Ventoinha 100%)', cmd: 'M106 S255' },
  { label: 'M106 S0 (Ventoinha Off)', cmd: 'M106 S0' },
  { label: 'RESTART', cmd: 'RESTART' },
  { label: 'FIRMWARE_RESTART', cmd: 'FIRMWARE_RESTART' },
  { label: 'M112 (Emergência)', cmd: 'M112' },
];

export const ConsolaModal: React.FC<{
  visivel: boolean;
  printer?: Printer;
  onFechar: () => void;
}> = ({ visivel, printer, onFechar }) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [comando, setComando] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<any>(null);

  const ip = printer?.ipAddress;
  const isMoonraker = printer?.firmware === 'moonraker';

  const carregarHistorico = useCallback(async () => {
    if (!ip || !isMoonraker) return;
    try {
      const res = await fetch(`http://${ip}/server/gcode_store?count=60`);
      if (!res.ok) return;
      const data = await res.json();
      const itens: any[] = data?.result?.gcode_store ?? [];
      const mapeados: LogItem[] = itens.map((item, idx) => ({
        id: `${item.time}-${idx}`,
        message: String(item.message || ''),
        time: Number(item.time || Date.now() / 1000),
        type:
          item.type === 'command'
            ? 'command'
            : String(item.message || '')
                  .toLowerCase()
                  .includes('error')
              ? 'error'
              : 'response',
      }));
      setLogs(mapeados);
    } catch {
      // rede em espera
    }
  }, [ip, isMoonraker]);

  useEffect(() => {
    if (!visivel) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    carregarHistorico();
    timerRef.current = setInterval(carregarHistorico, 2500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visivel, carregarHistorico]);

  const enviarComando = async (cmdTexto?: string) => {
    const txt = (cmdTexto ?? comando).trim();
    if (!txt || !ip) return;

    setAEnviar(true);
    const novoItem: LogItem = {
      id: `local-${Date.now()}`,
      message: txt,
      time: Date.now() / 1000,
      type: 'command',
    };
    setLogs(prev => [...prev, novoItem]);
    if (!cmdTexto) setComando('');

    try {
      await fetch(`http://${ip}/printer/gcode/script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: txt }),
      });
      setTimeout(carregarHistorico, 400);
    } catch (e: any) {
      setLogs(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          message: `Erro ao enviar: ${e?.message ?? String(e)}`,
          time: Date.now() / 1000,
          type: 'error',
        },
      ]);
    } finally {
      setAEnviar(false);
    }
  };

  const corTexto = (tipo: LogItem['type']) => {
    switch (tipo) {
      case 'command':
        return '#38bdf8'; // azul ciano
      case 'error':
        return '#f87171'; // vermelho suave
      default:
        return '#cbd5e1'; // cinzento claro
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      onRequestClose={onFechar}
      presentationStyle="pageSheet"
    >
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#0f172a',
        }}
      >
        {/* Cabeçalho */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#1e293b',
          }}
        >
          <View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="terminal-outline" size={18} color="#38bdf8" />
              <Text
                style={{ fontSize: 16, fontWeight: '700', color: '#f8fafc' }}
              >
                Consola G-Code
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {printer?.printerName ?? 'Impressora'} · {ip ?? 'sem IP'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onFechar}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              padding: 6,
              borderRadius: 8,
              backgroundColor: '#1e293b',
            }}
          >
            <Ionicons name="close" size={20} color="#f8fafc" />
          </TouchableOpacity>
        </View>

        {/* Chips de macros rápidas */}
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#1e293b',
          }}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MACROS_RAPIDAS}
            keyExtractor={item => item.cmd}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => enviarComando(item.cmd)}
                disabled={aEnviar}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 14,
                  backgroundColor: '#1e293b',
                  marginRight: 6,
                  borderWidth: 1,
                  borderColor: '#334155',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: item.cmd === 'M112' ? '#f87171' : '#38bdf8',
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Ecrã de saída do terminal */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={logs}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12, gap: 4 }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    color: '#64748b',
                    width: 48,
                  }}
                >
                  {new Date(item.time * 1000).toLocaleTimeString([], {
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </Text>
                <Text
                  selectable
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    color: corTexto(item.type),
                    lineHeight: 18,
                  }}
                >
                  {item.type === 'command' ? `> ${item.message}` : item.message}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 40,
                }}
              >
                <Text style={{ fontSize: 13, color: '#64748b' }}>
                  {isMoonraker
                    ? 'A aguardar comandos...'
                    : 'A consola interativa requer firmware Moonraker/Klipper.'}
                </Text>
              </View>
            }
          />

          {/* Barra de entrada */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              backgroundColor: '#1e293b',
              borderTopWidth: 1,
              borderTopColor: '#334155',
            }}
          >
            <TextInput
              value={comando}
              onChangeText={setComando}
              placeholder="Ex.: G28 X Y, M104 S210..."
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={() => enviarComando()}
              style={{
                flex: 1,
                height: 42,
                borderRadius: 10,
                backgroundColor: '#0f172a',
                paddingHorizontal: 12,
                fontSize: 14,
                fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                color: '#f8fafc',
                borderWidth: 1,
                borderColor: '#334155',
              }}
            />
            <TouchableOpacity
              onPress={() => enviarComando()}
              disabled={aEnviar || !comando.trim()}
              style={{
                height: 42,
                paddingHorizontal: 16,
                borderRadius: 10,
                backgroundColor: hexDe(p.acento),
                alignItems: 'center',
                justifyContent: 'center',
                opacity: aEnviar || !comando.trim() ? 0.6 : 1,
              }}
            >
              {aEnviar ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};
