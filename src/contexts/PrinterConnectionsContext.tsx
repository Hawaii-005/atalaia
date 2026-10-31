import { log } from '../utils/log';
import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  useContext,
  ReactNode,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { descobrirSoUdp, discoverPrinters } from '../utils/PrinterDiscovery';
import { AppState, NativeModules, AppStateStatus, Alert } from 'react-native';
import { Printer, ConnectionStatus, PrinterStatus } from '../types';
import { LigacaoSaturno } from '../saturn/ligacao';
import { redeSaturno } from '../saturn/rede';
import { estadoParaApp } from '../saturn/estadoApp';
import { inquirirSaturno } from '../saturn/descoberta';
import { descreverAck, PrinterRecusouError } from '../utils/errors';
import { isSdcpCommand, SdcpCommand } from '../utils/commands';
import {
  CommandValidationError,
  PrinterOfflineError,
  PrinterTimeoutError,
} from '../utils/errors';
import {
  ackDaResposta,
  pausePrintCommand,
  resumePrintCommand,
  startPrintCommand,
  stopPrintCommand,
} from '../utils/commands';
import * as Notifications from 'expo-notifications';
import { ItemFila, carregarFila, gravarFila } from '../utils/fila';
import { notify } from '../utils/notifications';
import { mensagemDoErro } from '../utils/errors';
import { lerTimelapse } from '../utils/timelapse';
import { requestPrinterRecovery } from '../utils/printerDiscoverySafety';
import { t, useIdioma } from '../i18n';
import { buildPrintMonitorStatus } from '../utils/printMonitorStatus';
import { createPrintMonitorService } from '../utils/printMonitorService';

interface PrinterConnectionsContextType {
  printers: Printer[];
  addPrinter: (
    printerName: string,
    ipAddress: string,
    mainboardId?: string,
    alternateIp?: string,
    extras?: { kind?: Printer['kind']; sdcpId?: string }
  ) => void;
  removePrinter: (id: string) => void;
  reconnectAll: () => void;
  sendCommand: (printerId: string, command: SdcpCommand<unknown>) => void;
  request: (
    printerId: string,
    command: SdcpCommand<unknown>,
    timeoutMs?: number
  ) => Promise<any>;
  updatePrinterIp: (id: string, ipAddress: string) => void;
  statusIntervalMs: number;
  fila: ItemFila[];
  filaAuto: boolean;
  pendentesMesaLimpa: Record<string, ItemFila>;
  adicionarAFila: (item: ItemFila) => void;
  removerDaFila: (id: string) => void;
  limparFila: () => void;
  definirFilaAuto: (ligada: boolean) => void;
  confirmarMesaLimpa: (printerId: string) => Promise<boolean>;
  cancelarMesaLimpa: (printerId: string) => void;
  setStatusInterval: (ms: number) => Promise<void>;
  /** Envia um .goo/.ctb para uma impressora de resina (comando 256). */
  carregarParaSaturno: (
    printerId: string,
    uri: string,
    nome: string,
    onProgresso?: (enviado: number, total: number) => void
  ) => Promise<void>;
  /** Manda imprimir um ficheiro que já esteja na impressora de resina. */
  imprimirNoSaturno: (printerId: string, nome: string) => Promise<void>;
}

const PrinterConnectionsContext = createContext<
  PrinterConnectionsContextType | undefined
>(undefined);

// A simple ID generator to avoid external dependencies.
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const CONNECTION_TIMEOUT = 3000; // 3 seconds
const DEFAULT_STATUS_INTERVAL = 31000; // 30 seconds

// Helper function to get readable command names
const getCommandName = (cmdCode: number): string => {
  switch (cmdCode) {
    case 129:
      return 'Pause Print';
    case 130:
      return 'Stop Print';
    case 131:
      return 'Resume Print';
    case 386:
      return 'Enable Video';
    case 403:
      return 'Change Setting';
    default:
      return `Command ${cmdCode}`;
  }
};

export const PrinterConnectionsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { idioma } = useIdioma();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [filaAuto, setFilaAuto] = useState(false);
  const [pendentesMesaLimpa, setPendentesMesaLimpa] = useState<
    Record<string, ItemFila>
  >({});

  const cancelarMesaLimpa = useCallback((printerId: string) => {
    setPendentesMesaLimpa(prev => {
      const nov = { ...prev };
      delete nov[printerId];
      return nov;
    });
  }, []);
  const filaRef = useRef<ItemFila[]>([]);
  const estadoAnteriorRef = useRef<Record<string, number | undefined>>({});
  const webSocketsRef = useRef<{ [key: string]: WebSocket }>({});
  // Impressoras de resina: falam SDCP V1 sobre MQTT, não WebSocket.
  const saturnoRef = useRef<{ [key: string]: LigacaoSaturno }>({});
  const vigiasSaturnoRef = useRef<{
    [key: string]: ReturnType<typeof setInterval>;
  }>({});
  const statusTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // Vigia de silêncio: se a impressora não enviar nada neste tempo, a ligação
  // TCP pode estar morta sem `onclose` (foi desligada da corrente, Wi-Fi caiu).
  const lastMessageRef = useRef<{ [key: string]: number }>({});
  const watchdogTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // Timeout de ligação por impressora: sem o guardar ficava um timer vivo a
  // criar sockets depois de remover a impressora ou de sair do ecrã.
  const timeoutsLigacaoRef = useRef<{
    [key: string]: ReturnType<typeof setTimeout>;
  }>({});
  const statusIntervalRef = useRef(DEFAULT_STATUS_INTERVAL);
  const [statusIntervalMs, setStatusIntervalMs] = useState(
    DEFAULT_STATUS_INTERVAL
  );
  const printersRef = useRef<Printer[]>([]);
  const pendingIpChangesRef = useRef(new Set<string>());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pendingRequestsRef = useRef<{
    [key: string]: {
      printerId: string;
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    };
  }>({});

  // Reconexão automática: temporizadores por impressora, nº de tentativas e
  // marca de fecho intencional (não reconectar quando fomos nós que fechámos).
  const reconnectTimersRef = useRef<{
    [key: string]: ReturnType<typeof setTimeout>;
  }>({});
  const reconnectAttemptsRef = useRef<{ [key: string]: number }>({});
  const intentionalCloseRef = useRef<{ [key: string]: boolean }>({});
  const timerPrimeiroPlano = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCommandsRef = useRef<{
    [key: string]: { command: string; timestamp: number };
  }>({});

  useEffect(() => {
    const pendingIpChanges = pendingIpChangesRef.current;
    const loadPrinters = async () => {
      try {
        const savedPrintersJSON = await AsyncStorage.getItem('printers');
        log('savedPrintersJSON', savedPrintersJSON);
        if (savedPrintersJSON) {
          const savedPrinters = JSON.parse(savedPrintersJSON);
          const loadedPrinters = savedPrinters.map(
            (p: Omit<Printer, 'connectionStatus'>) => ({
              ...p,
              connectionStatus: 'disconnected' as ConnectionStatus,
            })
          );
          setPrinters(loadedPrinters);
          printersRef.current = loadedPrinters;
          log('loadedPrinters', loadedPrinters);
          loadedPrinters.forEach((p: Printer) => connectToPrinter(p));
        }
      } catch (e) {
        console.error('Failed to load printers from storage', e);
      } finally {
        setHidratado(true);
      }
    };

    loadPrinters();

    return () => {
      pendingIpChanges.clear();
      // Sem reconexões nem pedidos órfãos depois do unmount: mata timers,
      // rejeita pedidos pendentes e tira os handlers antes de fechar, para o
      // `onclose` não tentar fazer setState sobre um componente morto.
      Object.values(reconnectTimersRef.current).forEach(timer =>
        clearTimeout(timer)
      );
      reconnectTimersRef.current = {};
      Object.values(statusTimersRef.current).forEach(timer =>
        clearInterval(timer)
      );
      statusTimersRef.current = {};
      Object.values(watchdogTimersRef.current).forEach(timer =>
        clearInterval(timer)
      );
      watchdogTimersRef.current = {};
      Object.values(timeoutsLigacaoRef.current).forEach(timer =>
        clearTimeout(timer)
      );
      timeoutsLigacaoRef.current = {};
      Object.entries(pendingRequestsRef.current).forEach(([, pedido]) => {
        clearTimeout(pedido.timer);
        pedido.reject(new PrinterOfflineError());
      });
      pendingRequestsRef.current = {};
      Object.entries(webSocketsRef.current).forEach(([id, ws]) => {
        intentionalCloseRef.current[id] = true;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
          ws.close();
        } catch {
          // Socket já fechado: nada a fazer.
        }
      });
      webSocketsRef.current = {};
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      log('App state changed from', appStateRef.current, 'to', nextAppState);

      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        log('App came to foreground, reconnecting disconnected printers...');
        // Fecho em segundo plano conta como recomeço: sem tentativas acumuladas.
        Object.keys(reconnectAttemptsRef.current).forEach(id => {
          delete reconnectAttemptsRef.current[id];
        });
        // Small delay to ensure app is fully active. Guardado para poder
        // ser cancelado se a app fechar entretanto.
        if (timerPrimeiroPlano.current) {
          clearTimeout(timerPrimeiroPlano.current);
        }
        timerPrimeiroPlano.current = setTimeout(() => {
          timerPrimeiroPlano.current = null;
          printersRef.current
            .filter(p => p.reconnectAttempt)
            .forEach(p => clearReconnectAttempt(p.id));
          reconnectDisconnectedPrinters();
        }, 1000);
      }

      if (nextAppState.match(/inactive|background/)) {
        // Em segundo plano a ligação mantém-se e as reconexões continuam, para
        // não aparecer a impressora como "Desligada" só por se sair da app. Os
        // avisos ficam calados (ver usePrintNotifications).
        log('App em segundo plano: ligações mantidas.');
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
      if (timerPrimeiroPlano.current) {
        clearTimeout(timerPrimeiroPlano.current);
        timerPrimeiroPlano.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const savePrinters = async () => {
      try {
        const printersToSave = printers.map(
          ({
            id,
            printerName,
            ipAddress,
            alternateIp,
            mainboardId,
            kind,
            sdcpId,
          }) => ({
            id,
            printerName,
            ipAddress,
            alternateIp,
            mainboardId,
            kind,
            sdcpId,
          })
        );
        await AsyncStorage.setItem('printers', JSON.stringify(printersToSave));
      } catch (e) {
        console.error('Failed to save printers to storage', e);
      }
    };

    // Antes de a leitura terminar, gravar apagava o que estava guardado.
    if (!hidratado) return;
    // Gravar sempre, mesmo lista vazia: senão remover a última impressora
    // deixa a lista antiga no AsyncStorage e ela volta no arranque seguinte.
    savePrinters();
  }, [printers, hidratado]);

  const updatePrinterStatus = (
    id: string,
    connectionStatus: ConnectionStatus
  ) => {
    setPrinters(prevPrinters => {
      const updatedPrinters = prevPrinters.map(p =>
        p.id === id ? { ...p, connectionStatus } : p
      );
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });
  };

  const updatePrinterData = (id: string, status: PrinterStatus) => {
    setPrinters(prevPrinters => {
      const updatedPrinters = prevPrinters.map(p =>
        p.id === id ? { ...p, status, lastUpdate: Date.now() } : p
      );
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });
  };

  const updatePrinterVideoUrl = (id: string, videoUrl: string) => {
    setPrinters(prevPrinters => {
      const updatedPrinters = prevPrinters.map(p =>
        p.id === id ? { ...p, videoUrl } : p
      );
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });
  };

  const sendStatusRequest = (printer: Printer, ws?: WebSocket) => {
    // O temporizador de 30 s e as chamadas manuais podem sobrepor-se; dois
    // Cmd:0 seguidos só atrasam a resposta.
    const agora = Date.now();
    const ultimo = ultimoPedidoEstadoRef.current[printer.id] ?? 0;
    if (agora - ultimo < 5000) {
      return;
    }
    ultimoPedidoEstadoRef.current[printer.id] = agora;
    log('Sending status request to printer', printer.printerName);
    const websocket = ws || webSocketsRef.current[printer.id];
    log('websocket', websocket);

    if (!websocket) {
      log(`No WebSocket found for ${printer.printerName}, stopping timer`);
      stopStatusTimer(printer.id);
      return;
    }

    if (websocket.readyState === WebSocket.OPEN) {
      const statusRequest = {
        Id: `${printer.printerName}-id-${Date.now()}`,
        Data: {
          Cmd: 0,
          Data: {},
          RequestID: `STATUS_REQUEST`,
          TimeStamp: Date.now(),
          MainboardID: '',
          From: 1,
        },
      };
      log(`Sending status request to ${printer.printerName}`);
      websocket.send(JSON.stringify(statusRequest));
    } else {
      log(
        `WebSocket not open for ${printer.printerName}, state: ${websocket.readyState}`
      );
      if (
        websocket.readyState === WebSocket.CLOSED ||
        websocket.readyState === WebSocket.CLOSING
      ) {
        log(`WebSocket closed for ${printer.printerName}, stopping timer`);
        stopStatusTimer(printer.id);
        updatePrinterStatus(printer.id, 'disconnected');
      }
    }
  };

  const startStatusTimer = (printer: Printer) => {
    // A resina não faz polling: recebe o estado por MQTT a cada ~5 s.
    if (printer.kind === 'resin') return;
    log(`Starting status timer for ${printer.printerName} (${printer.id})`);

    // Clear any existing timer for this printer
    if (statusTimersRef.current[printer.id]) {
      log(`Clearing existing timer for ${printer.id}`);
      clearInterval(statusTimersRef.current[printer.id]);
    }

    // Start a new timer
    const timer = setInterval(() => {
      log(`Timer tick for ${printer.printerName}`);
      // Check if printer is still connected before sending - use ref to get current state
      const currentPrinter = printersRef.current.find(p => p.id === printer.id);
      log('Current printers from ref:', printersRef.current);
      if (currentPrinter && currentPrinter.connectionStatus === 'connected') {
        sendStatusRequest(printer);
      } else {
        log(`Printer ${printer.printerName} is not connected, stopping timer`);
        stopStatusTimer(printer.id);
      }
    }, statusIntervalRef.current);

    log(`Created timer ${timer} for ${printer.id}`);
    statusTimersRef.current[printer.id] = timer;
    log(`Updated timers:`, Object.keys(statusTimersRef.current));
  };

  const stopStatusTimer = (printerId: string) => {
    log(`Attempting to stop status timer for printer ${printerId}`);
    log(`Current status timers:`, Object.keys(statusTimersRef.current));

    if (statusTimersRef.current[printerId]) {
      log(`Found timer for ${printerId}, clearing it`);
      clearInterval(statusTimersRef.current[printerId]);
      delete statusTimersRef.current[printerId];
      log(
        `Updated timers after removal:`,
        Object.keys(statusTimersRef.current)
      );
    } else {
      log(`No timer found for ${printerId}`);
    }
  };

  const ipHealRef = useRef<{ [key: string]: number }>({});
  // Instante do último Cmd:0 por impressora (travão de 5 s).
  const ultimoPedidoEstadoRef = useRef<{ [key: string]: number }>({});

  /**
   * The printer gets its address from DHCP, so it can come back on a different
   * IP after a reboot. Discovery can suggest a replacement, but cannot
   * authenticate it: require approval before changing the saved destination.
   */
  const healPrinterIp = async (printer: Printer) => {
    // Pelo Tailscale não se "cura" IP: a rede é outra e a descoberta UDP
    // só vê a rede local.
    if (printer.activeIp && printer.activeIp !== printer.ipAddress) {
      return;
    }
    // Curar o IP é barato por UDP, mas não a qualquer momento: só com a app
    // à frente, nunca a meio de uma impressão e no máximo a cada 5 minutos.
    if (AppState.currentState !== 'active') {
      return;
    }
    const estado = printer.status?.PrintInfo;
    const aImprimir =
      !!estado?.Filename && ![0, 7, 8, 9].includes(estado.Status ?? 0);
    if (aImprimir || pendingIpChangesRef.current.has(printer.id)) {
      return;
    }
    const ultima = ipHealRef.current[printer.id] ?? 0;
    if (Date.now() - ultima < 5 * 60 * 1000) {
      return;
    }
    ipHealRef.current[printer.id] = Date.now();
    pendingIpChangesRef.current.add(printer.id);

    try {
      const discovered = await descobrirSoUdp();
      const currentPrinter = () => {
        const current = printersRef.current.find(p => p.id === printer.id);
        const info = current?.status?.PrintInfo;
        if (
          !pendingIpChangesRef.current.has(printer.id) ||
          AppState.currentState !== 'active' ||
          !current ||
          current.ipAddress !== printer.ipAddress ||
          current.mainboardId !== printer.mainboardId ||
          current.connectionStatus === 'connected' ||
          (current.activeIp && current.activeIp !== current.ipAddress) ||
          (info?.Filename && ![0, 7, 8, 9].includes(info.Status ?? 0))
        ) {
          return undefined;
        }
        return current;
      };
      if (!currentPrinter()) return;
      const match = await requestPrinterRecovery(
        printer,
        discovered,
        candidate =>
          new Promise<boolean>(resolve => {
            Alert.alert(
              t('home.confirmarIpTitulo'),
              t('home.confirmarIpMensagem', {
                nome: printer.printerName,
                antigo: printer.ipAddress,
                novo: candidate.ip,
              }),
              [
                {
                  text: t('comum.cancelar'),
                  style: 'cancel',
                  onPress: () => resolve(false),
                },
                {
                  text: t('home.confirmarIpAceitar'),
                  onPress: () => resolve(true),
                },
              ],
              { cancelable: true, onDismiss: () => resolve(false) }
            );
          })
      );
      if (match && currentPrinter()) {
        log(`Approved IP change for ${printer.printerName}`);
        updatePrinterIp(printer.id, match.ip);
      }
    } catch (error) {
      log('Auto IP heal failed', error);
    } finally {
      pendingIpChangesRef.current.delete(printer.id);
    }
  };

  // Espera crescente para reconexão: 2 s, 4 s, 8 s, 16 s, depois fixa em 30 s.
  const reconnectDelay = (attempt: number) =>
    Math.min(2000 * Math.pow(2, attempt - 1), 30000);

  const clearReconnectTimer = (printerId: string) => {
    const timer = reconnectTimersRef.current[printerId];
    if (timer) {
      clearTimeout(timer);
      delete reconnectTimersRef.current[printerId];
    }
  };

  // Limpa o aviso "A reconectar" do estado mostrado nos ecrãs.
  const clearReconnectAttempt = (printerId: string) => {
    setPrinters(prevPrinters => {
      const target = prevPrinters.find(p => p.id === printerId);
      if (!target?.reconnectAttempt) {
        return prevPrinters;
      }
      const updated = prevPrinters.map(p =>
        p.id === printerId ? { ...p, reconnectAttempt: undefined } : p
      );
      printersRef.current = updated;
      return updated;
    });
  };

  // Agenda a próxima tentativa de reconexão. Lê sempre os dados recentes da
  // impressora, porque o IP pode ter sido curado enquanto esperava.
  const scheduleReconnect = (printer: Printer) => {
    // Em segundo plano não se reconecta; volta no próximo primeiro plano.
    if (AppState.currentState.match(/inactive|background/)) {
      return;
    }
    clearReconnectTimer(printer.id);
    const attempt = (reconnectAttemptsRef.current[printer.id] ?? 0) + 1;
    reconnectAttemptsRef.current[printer.id] = attempt;
    const delay = reconnectDelay(attempt);
    log(
      `A reconectar ${printer.printerName} (tentativa ${attempt}) em ${delay} ms`
    );

    setPrinters(prevPrinters => {
      const updated = prevPrinters.map(p =>
        p.id === printer.id ? { ...p, reconnectAttempt: attempt } : p
      );
      printersRef.current = updated;
      return updated;
    });

    reconnectTimersRef.current[printer.id] = setTimeout(() => {
      delete reconnectTimersRef.current[printer.id];
      const fresh = printersRef.current.find(p => p.id === printer.id);
      if (fresh) {
        connectToPrinter(fresh);
      }
    }, delay);
  };

  const SILENCIO_MAXIMO_MS = 60000;

  const stopWatchdog = (printerId: string) => {
    const timer = watchdogTimersRef.current[printerId];
    if (timer) {
      clearInterval(timer);
      delete watchdogTimersRef.current[printerId];
    }
  };

  // Sem mensagens durante SILENCIO_MAXIMO_MS, assume-se ligação morta: fechar o
  // socket faz o `onclose` correr a reconexão normal.
  const startWatchdog = (printer: Printer, ws: WebSocket) => {
    stopWatchdog(printer.id);
    lastMessageRef.current[printer.id] = Date.now();
    watchdogTimersRef.current[printer.id] = setInterval(() => {
      if (webSocketsRef.current[printer.id] !== ws) {
        stopWatchdog(printer.id);
        return;
      }
      const ultimo = lastMessageRef.current[printer.id] ?? 0;
      if (Date.now() - ultimo < SILENCIO_MAXIMO_MS) {
        return;
      }
      log(
        `Sem resposta de ${printer.printerName} há ${Math.round(
          (Date.now() - ultimo) / 1000
        )} s: a fechar para reconectar.`
      );
      stopWatchdog(printer.id);
      try {
        ws.close();
      } catch (e) {
        console.error('Falha ao fechar o socket inactivo:', e);
      }
    }, 5000);
  };

  // Fecho pedido pela app: não deve disparar reconexão automática.
  const markIntentionalClose = (printerId: string) => {
    intentionalCloseRef.current[printerId] = true;
  };

  /**
   * Resina (Saturn 3 Ultra): a impressora liga-se a um broker MQTT nosso e é
   * por aí que chega o estado e vão os comandos. Não há WebSocket nenhum.
   */
  const ligarSaturno = async (printer: Printer) => {
    const anterior = saturnoRef.current[printer.id];
    if (anterior) {
      delete saturnoRef.current[printer.id];
      anterior.desligar(false).catch(() => undefined);
    }
    const vigiaAnterior = vigiasSaturnoRef.current[printer.id];
    if (vigiaAnterior) {
      clearInterval(vigiaAnterior);
      delete vigiasSaturnoRef.current[printer.id];
    }

    intentionalCloseRef.current[printer.id] = false;
    updatePrinterStatus(printer.id, 'connecting');
    const alvo = printer.activeIp ?? printer.ipAddress;

    try {
      let sdcpId = printer.sdcpId;
      let mainboardId = printer.mainboardId;
      if (!sdcpId || !mainboardId) {
        const resposta = await inquirirSaturno(alvo);
        sdcpId = resposta.id;
        mainboardId = resposta.atributos.MainboardID;
        setPrinters(prev => {
          const lista = prev.map(p =>
            p.id === printer.id ? { ...p, sdcpId, mainboardId } : p
          );
          printersRef.current = lista;
          return lista;
        });
      }

      const ligacao = new LigacaoSaturno(redeSaturno, {
        aoEstado: estado =>
          updatePrinterData(printer.id, estadoParaApp(estado)),
        aoLigar: () => updatePrinterStatus(printer.id, 'connected'),
        aoDesligar: motivo => {
          log(`saturno: ${printer.printerName} desligou (${motivo})`);
          updatePrinterStatus(printer.id, 'disconnected');
          const actual = printersRef.current.find(p => p.id === printer.id);
          if (actual && !intentionalCloseRef.current[printer.id]) {
            scheduleReconnect(actual);
          }
        },
      });
      saturnoRef.current[printer.id] = ligacao;
      await ligacao.ligar(alvo, sdcpId ?? '', mainboardId ?? '');

      // A impressora diz quando muda de estado, mas se ficar calada (Wi-Fi
      // caído) o socket pendura-se: ao fim de 45 s sem nada, reconecta-se.
      vigiasSaturnoRef.current[printer.id] = setInterval(() => {
        const actual = printersRef.current.find(p => p.id === printer.id);
        if (!actual) return;
        const ultimo = actual.lastUpdate ?? 0;
        if (Date.now() - ultimo <= 45000) return;
        clearInterval(vigiasSaturnoRef.current[printer.id]);
        delete vigiasSaturnoRef.current[printer.id];
        ligacao.desligar(false).catch(() => undefined);
        delete saturnoRef.current[printer.id];
        updatePrinterStatus(printer.id, 'disconnected');
        if (!intentionalCloseRef.current[printer.id]) scheduleReconnect(actual);
      }, 15000);
    } catch (erro) {
      log('saturno: falhou a ligação', erro);
      updatePrinterStatus(printer.id, 'disconnected');
      const actual = printersRef.current.find(p => p.id === printer.id);
      if (actual && !intentionalCloseRef.current[printer.id]) {
        scheduleReconnect(actual);
      }
    }
  };

  const connectToPrinter = (printer: Printer) => {
    if (printer.kind === 'resin') {
      ligarSaturno(printer);
      return;
    }
    // If a websocket for this printer already exists, close it before creating a new one.
    if (webSocketsRef.current[printer.id]) {
      markIntentionalClose(printer.id);
      webSocketsRef.current[printer.id].close();
    }
    clearReconnectTimer(printer.id);
    if (timeoutsLigacaoRef.current[printer.id]) {
      clearTimeout(timeoutsLigacaoRef.current[printer.id]);
      delete timeoutsLigacaoRef.current[printer.id];
    }
    intentionalCloseRef.current[printer.id] = false;

    updatePrinterStatus(printer.id, 'connecting');
    // LAN primeiro; se houver um endereço alternativo (Tailscale) e a LAN não
    // responder, tenta-se esse antes de desistir.
    const alvo = printer.activeIp ?? printer.ipAddress;
    const ws = new WebSocket(`ws://${alvo}/websocket`);

    const timeout = setTimeout(() => {
      log(`Connection to ${printer.printerName} timed out on ${alvo}.`);
      updatePrinterStatus(printer.id, 'timeout');
      ws.close();
      if (printer.alternateIp && alvo !== printer.alternateIp) {
        const comAlternativo: Printer = {
          ...printer,
          activeIp: printer.alternateIp,
        };
        setPrinters(prev => {
          const lista = prev.map(p =>
            p.id === printer.id ? comAlternativo : p
          );
          printersRef.current = lista;
          return lista;
        });
        connectToPrinter(comAlternativo);
        return;
      }
      healPrinterIp(printer);
    }, CONNECTION_TIMEOUT);
    timeoutsLigacaoRef.current[printer.id] = timeout;

    ws.onopen = () => {
      clearTimeout(timeout);
      delete timeoutsLigacaoRef.current[printer.id];
      log(`Connected to printer: ${printer.printerName} (${alvo})`);
      // Guardar por onde se ligou, para câmara, ficheiros e envio usarem o mesmo.
      setPrinters(prev => {
        const lista = prev.map(p =>
          p.id === printer.id ? { ...p, activeIp: alvo } : p
        );
        printersRef.current = lista;
        return lista;
      });
      updatePrinterStatus(printer.id, 'connected');

      // Ligação estabelecida: repor tentativas de reconexão e limpar o aviso.
      delete reconnectAttemptsRef.current[printer.id];
      clearReconnectAttempt(printer.id);

      // Set initial lastUpdate when connected
      setPrinters(prevPrinters => {
        const updatedPrinters = prevPrinters.map(p =>
          p.id === printer.id ? { ...p, lastUpdate: Date.now() } : p
        );
        printersRef.current = updatedPrinters;
        return updatedPrinters;
      });

      // Send enable command
      const enableCommand = {
        Id: '',
        Data: {
          Cmd: 386,
          Data: {
            Enable: 1,
          },
          RequestID: 'ENABLE_VIDEO',
          MainboardID: '',
          TimeStamp: Date.now(),
          From: 1,
        },
      };
      log(`Sending enable command to ${printer.printerName}:`, enableCommand);
      ws.send(JSON.stringify(enableCommand));

      // Send initial status request using the ws instance directly
      sendStatusRequest(printer, ws);

      // Start periodic status updates
      startStatusTimer(printer);
      startWatchdog(printer, ws);
    };

    ws.onmessage = event => {
      lastMessageRef.current[printer.id] = Date.now();
      try {
        const data = JSON.parse(event.data);

        const pendingRequestId = data?.Data?.RequestID;
        const pending = pendingRequestId
          ? pendingRequestsRef.current[pendingRequestId]
          : undefined;
        if (pending) {
          clearTimeout(pending.timer);
          delete pendingRequestsRef.current[pendingRequestId];
          const resposta = data?.Data?.Data ?? {};
          // Ack > 0 = recebeu e recusou. Quem espera pela promessa tem de
          // saber, senão o ecrã muda como se tivesse funcionado.
          const ack = (resposta as { Ack?: number }).Ack;
          if (typeof ack === 'number' && ack > 0) {
            pending.reject(new PrinterRecusouError(ack, 'comando'));
          } else {
            pending.resolve(resposta);
          }
          return;
        }

        // Learn the stable hardware id so the printer can be found again after
        // a DHCP change, even if the user renamed it in the app.
        const mainboardId = data?.Data?.MainboardID;
        if (mainboardId) {
          setPrinters(prev => {
            const target = prev.find(p => p.id === printer.id);
            if (!target || target.mainboardId === mainboardId) {
              return prev;
            }
            const updated = prev.map(p =>
              p.id === printer.id ? { ...p, mainboardId } : p
            );
            printersRef.current = updated;
            return updated;
          });
        }

        if (data.Status) {
          log(`Status update from ${printer.printerName}:`, data.Status);
          updatePrinterData(printer.id, data.Status);
        }

        // Check for ACK response
        if (
          data.Data &&
          data.Data.Data &&
          data.Data.Data.Ack === 0 &&
          data.Data.RequestID !== 'STATUS_REQUEST'
        ) {
          if (data.Data.Data.VideoUrl) {
            log('VideoUrl', data.Data.Data.VideoUrl);
            updatePrinterVideoUrl(printer.id, data.Data.Data.VideoUrl);
          }
          log(`ACK received from ${printer.printerName}`);
          // Send status request using the ws instance directly
          sendStatusRequest(printer, ws);
        }
        if (data.Data && data.Data.Data && data.Data.Data.Ack > 0) {
          log(`ACK non zero received from ${printer.printerName}`);
          const requestId = data.Data.RequestID;
          const commandName =
            pendingCommandsRef.current[requestId]?.command || 'comando';

          // Remove from pending commands
          delete pendingCommandsRef.current[requestId];

          // Mensagem honesta e em português: o código Ack é o que a máquina
          // devolveu, sem inventar causas que não foram observadas.
          const aviso = descreverAck(data.Data.Data.Ack as number, commandName);
          Alert.alert(aviso.titulo, aviso.mensagem, [{ text: 'OK' }]);
        }
      } catch (error) {
        log(`Error parsing message from ${printer.printerName}:`, error);
        log(`Raw message:`, event.data);
      }
    };

    ws.onerror = (error: unknown) => {
      if (webSocketsRef.current[printer.id] !== ws) {
        return; // Socket antigo que já foi substituído.
      }
      clearTimeout(timeout);
      console.error(`error for ${printer.printerName}:`, error);
      if (
        error &&
        (error as Error).message === 'Software caused connection abort'
      ) {
        updatePrinterStatus(printer.id, 'disconnected');
      } else {
        updatePrinterStatus(printer.id, 'error');
      }
      stopStatusTimer(printer.id);
      stopWatchdog(printer.id);
      healPrinterIp(printer);
    };

    ws.onclose = event => {
      clearTimeout(timeout);
      log(
        `Disconnected from printer: ${printer.printerName}, code: ${event.code}, reason: ${event.reason}`
      );

      // Fecho de um socket antigo (substituído) não reinicia a lógica de ligação.
      if (webSocketsRef.current[printer.id] !== ws) {
        return;
      }

      stopStatusTimer(printer.id);
      stopWatchdog(printer.id);
      healPrinterIp(printer);

      // Pedidos pendentes nesta ligação não ficam pendurados.
      Object.keys(pendingRequestsRef.current).forEach(key => {
        const pending = pendingRequestsRef.current[key];
        if (pending.printerId !== printer.id) {
          return;
        }
        clearTimeout(pending.timer);
        delete pendingRequestsRef.current[key];
        pending.reject(new PrinterOfflineError());
      });

      // Fecho pedido pela app (desligar impressora, mudar IP): sem reconexão.
      const wasIntentional = intentionalCloseRef.current[printer.id];
      delete intentionalCloseRef.current[printer.id];
      if (wasIntentional) {
        return;
      }

      setPrinters(prev => {
        const printerToUpdate = prev.find(p => p.id === printer.id);
        if (
          printerToUpdate &&
          (printerToUpdate.connectionStatus === 'connected' ||
            printerToUpdate.connectionStatus === 'connecting')
        ) {
          const updatedPrinters = prev.map(p =>
            p.id === printer.id
              ? { ...p, connectionStatus: 'disconnected' as ConnectionStatus }
              : p
          );
          printersRef.current = updatedPrinters;
          return updatedPrinters;
        }
        return prev;
      });

      // Ligação caiu sem ordem nossa: reconectar com espera crescente.
      scheduleReconnect(printer);
    };

    webSocketsRef.current[printer.id] = ws;
  };

  const addPrinter = (
    printerName: string,
    ipAddress: string,
    mainboardId?: string,
    alternateIp?: string,
    extras?: { kind?: Printer['kind']; sdcpId?: string }
  ) => {
    const newPrinter: Printer = {
      id: generateId(),
      printerName,
      ipAddress,
      alternateIp: alternateIp?.trim() || undefined,
      connectionStatus: 'connecting',
      mainboardId,
      kind: extras?.kind ?? 'fdm',
      sdcpId: extras?.sdcpId,
    };

    // Verificar ANTES de ligar: se o IP já existe, a lista não muda e ficaria
    // um WebSocket/timer/watchdog a vigiar uma impressora que não está lá.
    if (printersRef.current.some(p => p.ipAddress === ipAddress)) {
      log('printer already exists', ipAddress);
      return;
    }

    setPrinters(prevPrinters => {
      const updatedPrinters = [...prevPrinters, newPrinter];
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });

    connectToPrinter(newPrinter);
  };

  const removePrinter = (id: string) => {
    // Resina: despede-se da impressora (comando 64) e fecha os servidores.
    const ligacaoResina = saturnoRef.current[id];
    if (ligacaoResina) {
      delete saturnoRef.current[id];
      ligacaoResina.desligar().catch(() => undefined);
    }
    const vigiaResina = vigiasSaturnoRef.current[id];
    if (vigiaResina) {
      clearInterval(vigiaResina);
      delete vigiasSaturnoRef.current[id];
    }
    // Fecho intencional: matar temporizadores antes de fechar o socket.
    clearReconnectTimer(id);
    stopWatchdog(id);
    delete reconnectAttemptsRef.current[id];
    delete intentionalCloseRef.current[id];
    markIntentionalClose(id);
    const ws = webSocketsRef.current[id];
    if (ws) {
      ws.close();
      delete webSocketsRef.current[id];
    }
    stopStatusTimer(id);
    log('remove printer', id);
    setPrinters(prevPrinters => {
      const updatedPrinters = prevPrinters.filter(p => p.id !== id);
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });
    // A gravação fica a cargo do efeito que observa `printers` (uma só
    // escrita, sem corrida com o get/set manual que aqui existia).
  };

  const carregarParaSaturno = async (
    printerId: string,
    uri: string,
    nome: string,
    onProgresso?: (enviado: number, total: number) => void
  ) => {
    const ligacao = saturnoRef.current[printerId];
    if (!ligacao?.estaLigado) throw new PrinterOfflineError();
    await ligacao.carregar(uri, nome, onProgresso);
  };

  const imprimirNoSaturno = async (printerId: string, nome: string) => {
    const ligacao = saturnoRef.current[printerId];
    if (!ligacao?.estaLigado) throw new PrinterOfflineError();
    await ligacao.imprimir(nome);
  };

  const updatePrinterIp = (id: string, ipAddress: string) => {
    const printer = printersRef.current.find(p => p.id === id);
    if (!printer || printer.ipAddress === ipAddress) {
      return;
    }

    log(
      `Updating ${printer.printerName} IP ${printer.ipAddress} -> ${ipAddress}`
    );

    const existingSocket = webSocketsRef.current[id];
    if (existingSocket) {
      // Fecho intencional: a nova ligação é criada a seguir.
      clearReconnectTimer(id);
      markIntentionalClose(id);
      try {
        existingSocket.close();
      } catch (e) {
        log('Failed to close old socket', e);
      }
      delete webSocketsRef.current[id];
    }
    stopStatusTimer(id);

    const updatedPrinter: Printer = {
      ...printer,
      ipAddress,
      // O endereço que estava a funcionar era o antigo: não pode sobreviver
      // à mudança, senão a app volta a ligar-se ao IP morto.
      activeIp: undefined,
      connectionStatus: 'connecting',
      videoUrl: undefined,
    };

    setPrinters(prevPrinters => {
      const updatedPrinters = prevPrinters.map(p =>
        p.id === id ? updatedPrinter : p
      );
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });

    connectToPrinter(updatedPrinter);
  };

  const request = useCallback(
    (printerId: string, command: SdcpCommand<unknown>, timeoutMs = 8000) =>
      new Promise<any>((resolve, reject) => {
        // Rejeita já, sem tocar na rede, se o comando não for um SDCP válido.
        if (!isSdcpCommand(command)) {
          reject(
            new CommandValidationError(
              'Comando SDCP inválido: tem de vir de um construtor de src/utils/commands.ts.'
            )
          );
          return;
        }
        const printer = printersRef.current.find(item => item.id === printerId);

        // Resina: os mesmos construtores de comando, mas por MQTT.
        if (printer?.kind === 'resin') {
          const ligacao = saturnoRef.current[printerId];
          if (!ligacao?.estaLigado) {
            reject(new PrinterOfflineError());
            return;
          }
          const cmd = command.Data.Cmd;
          const payload = (command.Data.Data ?? {}) as any;
          let promessa: Promise<any>;
          switch (cmd) {
            case 0:
              promessa = ligacao.pedido(0, null, timeoutMs);
              break;
            case 129:
              promessa = ligacao.pausar();
              break;
            case 130:
              promessa = ligacao.pararImpressao();
              break;
            case 131:
              promessa = ligacao.retomar();
              break;
            case 128:
              promessa = ligacao.imprimir(
                String(payload?.Filename ?? ''),
                Number(payload?.StartLayer ?? 0)
              );
              break;
            default:
              reject(
                new CommandValidationError(
                  `O comando ${cmd} não existe nesta impressora de resina.`
                )
              );
              return;
          }
          promessa.then(resolve).catch(reject);
          return;
        }

        const ws = webSocketsRef.current[printerId];
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new PrinterOfflineError());
          return;
        }
        const requestId = `REQ_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const timer = setTimeout(() => {
          // Tempo esgotado: limpar o pedido para não vazar memória.
          delete pendingRequestsRef.current[requestId];
          reject(new PrinterTimeoutError());
        }, timeoutMs);
        pendingRequestsRef.current[requestId] = {
          printerId,
          resolve,
          reject,
          timer,
        };
        ws.send(
          JSON.stringify({
            Id: 'request',
            Data: {
              Cmd: command.Data.Cmd,
              Data: command.Data.Data,
              RequestID: requestId,
              MainboardID: printer?.mainboardId ?? '',
              TimeStamp: Date.now(),
              From: 1,
            },
          })
        );
      }),
    []
  );

  // Botões dos avisos: agir sem abrir a app (com ela em segundo plano).
  useEffect(() => {
    const inscricao = Notifications.addNotificationResponseReceivedListener(
      async resposta => {
        const dados = resposta.notification.request.content.data as {
          printerId?: string;
        };
        const printerId = dados?.printerId;
        if (!printerId) return;
        const acao = resposta.actionIdentifier;
        try {
          if (acao === 'PAUSAR') {
            await request(
              printerId,
              pausePrintCommand({ id: `aviso-pausa-${Date.now()}` })
            );
          } else if (acao === 'RETOMAR') {
            await request(
              printerId,
              resumePrintCommand({ id: `aviso-retoma-${Date.now()}` })
            );
          } else if (acao === 'PARAR') {
            await request(
              printerId,
              stopPrintCommand({ id: `aviso-parar-${Date.now()}` })
            );
          }
        } catch (erro) {
          const texto =
            erro instanceof Error ? erro.message : 'Comando não aceite.';
          await Notifications.scheduleNotificationAsync({
            content: { title: 'Comando recusado', body: texto },
            trigger: null,
          });
        }
      }
    );
    return () => inscricao.remove();
  }, [request]);

  // ---------- Serviço em primeiro plano ----------
  // Enquanto há impressão, o Android pode matar a app e os avisos morrem com
  // ela. Uma notificação fixa do serviço evita isso; para quando acaba.
  const monitorRef = useRef<ReturnType<
    typeof createPrintMonitorService
  > | null>(null);
  if (!monitorRef.current && NativeModules.MonitorServico) {
    monitorRef.current = createPrintMonitorService(
      NativeModules.MonitorServico,
      (error: unknown) =>
        console.error('Failed to update print monitor:', error)
    );
  }
  useEffect(() => {
    const refresh = () => {
      void monitorRef.current?.set(
        buildPrintMonitorStatus(printers, statusIntervalMs, Date.now(), t)
      );
    };
    if (!monitorRef.current) return;
    refresh();
    // Retry bridge failures and reselect live jobs; only printer heartbeats
    // extend freshness, never this timer or an unrelated provider render.
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [printers, idioma, statusIntervalMs]);
  useEffect(() => {
    return () => {
      void monitorRef.current?.set(null);
    };
  }, []);

  // ---------- Fila de impressão ----------
  useEffect(() => {
    carregarFila().then(lista => {
      filaRef.current = lista;
      setFila(lista);
    });
    AsyncStorage.getItem('filaAuto')
      .then(valor => setFilaAuto(valor === '1'))
      .catch(() => undefined);
  }, []);

  const adicionarAFila = useCallback((item: ItemFila) => {
    const nova = [...filaRef.current, item];
    filaRef.current = nova;
    setFila(nova);
    gravarFila(nova);
  }, []);

  const removerDaFila = useCallback((id: string) => {
    const nova = filaRef.current.filter(item => item.id !== id);
    filaRef.current = nova;
    setFila(nova);
    gravarFila(nova);
  }, []);

  const limparFila = useCallback(() => {
    filaRef.current = [];
    setFila([]);
    gravarFila([]);
  }, []);

  const definirFilaAuto = useCallback((ligada: boolean) => {
    setFilaAuto(ligada);
    AsyncStorage.setItem('filaAuto', ligada ? '1' : '0').catch(() => undefined);
  }, []);

  // Só arranca com a fila ligada e na transição para "terminada" (9). Sem a
  // transição disparava em cada actualização de estado com 9.
  const aArrancarRef = useRef<Record<string, boolean>>({});
  const imprimiuRef = useRef<Record<string, boolean>>({});
  // Depois de arrancar um trabalho a máquina demora a sair do estado 9; sem
  // esta pausa o mesmo fim de trabalho podia arrancar dois itens da fila.
  const ultimoArranqueRef = useRef<Record<string, number>>({});

  const executarArranque = useCallback(
    async (printer: Printer, proximo: ItemFila): Promise<boolean> => {
      if (aArrancarRef.current[printer.id]) return false;
      if (Date.now() - (ultimoArranqueRef.current[printer.id] ?? 0) < 120_000)
        return false;

      aArrancarRef.current[printer.id] = true;
      try {
        const timelapse = await lerTimelapse(printer.id).catch(() => false);
        const comando = startPrintCommand(proximo.name, {
          nivelar: false,
          lado: 0,
          timelapse: timelapse ? 1 : 0,
        });
        for (let tentativa = 1; tentativa <= 4; tentativa++) {
          try {
            const resposta = await request(printer.id, comando, 15000);
            const ack = ackDaResposta(resposta) ?? 0;
            if (ack === 0) {
              ultimoArranqueRef.current[printer.id] = Date.now();
              removerDaFila(proximo.id);
              cancelarMesaLimpa(printer.id);
              notify(
                'A arrancar o próximo',
                `${printer.printerName} começou ${proximo.label}.`,
                { printerId: printer.id }
              );
              return true;
            }
            log(
              'fila: a máquina recusou',
              descreverAck(ack, 'imprimir').mensagem,
              'tentativa',
              tentativa
            );
          } catch (erro) {
            log('fila: tentativa falhou', tentativa, erro);
          }
          if (tentativa < 4) {
            await new Promise(resolver => setTimeout(resolver, 6000));
          }
        }
        notify(
          'Não arrancou',
          `${proximo.label}: a máquina não aceitou. O trabalho fica na fila.`,
          { printerId: printer.id }
        );
        return false;
      } finally {
        aArrancarRef.current[printer.id] = false;
      }
    },
    [request, removerDaFila, cancelarMesaLimpa]
  );

  const confirmarMesaLimpa = useCallback(
    async (printerId: string): Promise<boolean> => {
      const printer = printersRef.current.find(p => p.id === printerId);
      const proximo = pendentesMesaLimpa[printerId];
      if (!printer || !proximo) return false;
      return executarArranque(printer, proximo);
    },
    [pendentesMesaLimpa, executarArranque]
  );

  const arrancarProximo = useCallback(
    async (printer: Printer | undefined): Promise<boolean> => {
      if (!printer || !filaAuto) return false;
      const proximo = filaRef.current.find(
        item => item.printerId === printer.id
      );
      if (!proximo) return false;

      setPendentesMesaLimpa(prev => ({ ...prev, [printer.id]: proximo }));
      notify(
        'Mesa limpa?',
        `${printer.printerName}: confirma que a mesa está limpa para arrancar ${proximo.label}.`,
        { printerId: printer.id },
        'fila-arranque-mesa-limpa'
      );
      return false;
    },
    [filaAuto]
  );

  // Dispara na transição para "terminada" (9). Sem exigir a transição, corria
  // em cada actualização de estado com 9.
  useEffect(() => {
    printers.forEach(printer => {
      const estado = printer.status?.PrintInfo?.Status;
      const anterior = estadoAnteriorRef.current[printer.id];
      estadoAnteriorRef.current[printer.id] = estado;
      // 9 = terminada; 5/6/13 = a imprimir. Só conta como fim de um trabalho se
      // antes o vimos a imprimir: sem isto, um 9 passageiro logo a seguir ao
      // arranque consumia mais um item da fila.
      if (estado === 5 || estado === 6 || estado === 13) {
        imprimiuRef.current[printer.id] = true;
        return;
      }
      if (anterior == null || anterior === estado || estado !== 9) return;
      if (!imprimiuRef.current[printer.id]) return;
      imprimiuRef.current[printer.id] = false;
      void arrancarProximo(printer);
    });
  }, [printers, arrancarProximo]);

  // Com o ecrã desligado a app deixa de receber actualizações e a transição
  // perde-se (o aviso do sistema chega, mas o estado não). Ao voltar ao primeiro
  // plano, se a máquina está em "terminada" e há fila, tenta outra vez.
  useEffect(() => {
    const sub = AppState.addEventListener('change', estado => {
      if (estado !== 'active') return;
      setTimeout(() => {
        printersRef.current.forEach(printer => {
          if (printer.status?.PrintInfo?.Status === 9)
            void arrancarProximo(printer);
        });
      }, 1500);
    });
    return () => sub.remove();
  }, [arrancarProximo]);

  const sendCommand = (printerId: string, command: SdcpCommand<unknown>) => {
    // Erro de programação: rejeita já, sem tocar na rede.
    if (!isSdcpCommand(command)) {
      throw new CommandValidationError(
        'Comando SDCP inválido: tem de vir de um construtor de src/utils/commands.ts.'
      );
    }
    const alvoResina = printersRef.current.find(p => p.id === printerId);
    if (alvoResina?.kind === 'resin') {
      request(printerId, command).catch(erro =>
        log('saturno: comando recusado', erro)
      );
      return;
    }
    const ws = webSocketsRef.current[printerId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      log(`Sending command to printer ${printerId}:`, command);

      // Track the command for ACK response
      const requestId = command.Data?.RequestID;
      if (requestId) {
        const commandName = getCommandName(command.Data?.Cmd);
        pendingCommandsRef.current[requestId] = {
          command: commandName,
          timestamp: Date.now(),
        };

        // Clean up old pending commands (older than 30 seconds)
        const now = Date.now();
        Object.keys(pendingCommandsRef.current).forEach(key => {
          if (now - pendingCommandsRef.current[key].timestamp > 30000) {
            delete pendingCommandsRef.current[key];
          }
        });
      }

      ws.send(JSON.stringify(command));
    } else {
      console.error(
        `Cannot send command: WebSocket not connected for printer ${printerId}`
      );
    }
  };

  const reconnectAll = () => {
    log('Reconnecting to all printers...');
    // Reconexão manual recomeça no endereço principal: se entretanto voltou a
    // casa, é a LAN que se deve tentar primeiro.
    printers.forEach(printer => {
      delete reconnectAttemptsRef.current[printer.id];
      const semAlternativo: Printer = { ...printer, activeIp: undefined };
      setPrinters(prev => {
        const lista = prev.map(p => (p.id === printer.id ? semAlternativo : p));
        printersRef.current = lista;
        return lista;
      });
      connectToPrinter(semAlternativo);
    });
  };

  const reconnectDisconnectedPrinters = () => {
    log('Reconnecting only disconnected printers...');
    log(
      'Current printer statuses:',
      printersRef.current.map(p => `${p.printerName}: ${p.connectionStatus}`)
    );

    const disconnectedPrinters = printersRef.current.filter(
      p =>
        p.connectionStatus === 'disconnected' ||
        p.connectionStatus === 'error' ||
        p.connectionStatus === 'timeout'
    );

    if (disconnectedPrinters.length > 0) {
      log(
        `Found ${disconnectedPrinters.length} disconnected printers, reconnecting...`
      );
      disconnectedPrinters.forEach(printer => {
        log(
          `Attempting to reconnect to ${printer.printerName} (${printer.connectionStatus})`
        );
        // Volta ao primeiro plano: ciclo de tentativas recomeça.
        delete reconnectAttemptsRef.current[printer.id];
        connectToPrinter(printer);
      });
    } else {
      log('All printers are connected, no need to reconnect');
    }
  };

  const updateStatusInterval = useCallback(
    async (ms: number) => {
      statusIntervalRef.current = ms;
      setStatusIntervalMs(ms);
      try {
        await AsyncStorage.setItem('statusIntervalMs', String(ms));
      } catch (error) {
        log('could not save status interval', error);
      }
      // restart timers so the new value applies immediately
      printersRef.current
        .filter(printer => printer.connectionStatus === 'connected')
        .forEach(printer => startStatusTimer(printer));
    },
    [startStatusTimer]
  );

  useEffect(() => {
    AsyncStorage.getItem('statusIntervalMs')
      .then(stored => {
        const parsed = Number(stored);
        if (parsed && parsed >= 3000) {
          statusIntervalRef.current = parsed;
          setStatusIntervalMs(parsed);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <PrinterConnectionsContext.Provider
      value={{
        printers,
        addPrinter,
        removePrinter,
        reconnectAll,
        sendCommand,
        request,
        updatePrinterIp,
        statusIntervalMs,
        setStatusInterval: updateStatusInterval,
        carregarParaSaturno,
        imprimirNoSaturno,
        fila,
        filaAuto,
        pendentesMesaLimpa,
        adicionarAFila,
        removerDaFila,
        limparFila,
        definirFilaAuto,
        confirmarMesaLimpa,
        cancelarMesaLimpa,
      }}
    >
      {children}
    </PrinterConnectionsContext.Provider>
  );
};

export const usePrinterConnections = () => {
  const context = useContext(PrinterConnectionsContext);
  if (context === undefined) {
    throw new Error(
      'usePrinterConnections must be used within a PrinterConnectionsProvider'
    );
  }
  return context;
};
