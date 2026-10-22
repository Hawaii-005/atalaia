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
import { discoverPrinters } from '../utils/PrinterDiscovery';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { Printer, ConnectionStatus, PrinterStatus } from '../types';
import { descreverAck } from '../utils/errors';
import { isSdcpCommand, SdcpCommand } from '../utils/commands';
import {
  CommandValidationError,
  PrinterOfflineError,
  PrinterTimeoutError,
} from '../utils/errors';

interface PrinterConnectionsContextType {
  printers: Printer[];
  addPrinter: (
    printerName: string,
    ipAddress: string,
    mainboardId?: string
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
  setStatusInterval: (ms: number) => Promise<void>;
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
  const [printers, setPrinters] = useState<Printer[]>([]);
  const webSocketsRef = useRef<{ [key: string]: WebSocket }>({});
  const statusTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // Vigia de silêncio: se a impressora não enviar nada neste tempo, a ligação
  // TCP pode estar morta sem `onclose` (foi desligada da corrente, Wi-Fi caiu).
  const lastMessageRef = useRef<{ [key: string]: number }>({});
  const watchdogTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const statusIntervalRef = useRef(DEFAULT_STATUS_INTERVAL);
  const [statusIntervalMs, setStatusIntervalMs] = useState(
    DEFAULT_STATUS_INTERVAL
  );
  const printersRef = useRef<Printer[]>([]);
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
  const reconnectTimersRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>(
    {}
  );
  const reconnectAttemptsRef = useRef<{ [key: string]: number }>({});
  const intentionalCloseRef = useRef<{ [key: string]: boolean }>({});


  const pendingCommandsRef = useRef<{
    [key: string]: { command: string; timestamp: number };
  }>({});

  useEffect(() => {
    const loadPrinters = async () => {
      try {
        const savedPrintersJSON = await AsyncStorage.getItem('printers');
        console.log('savedPrintersJSON', savedPrintersJSON);
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
          console.log('loadedPrinters', loadedPrinters);
          loadedPrinters.forEach((p: Printer) => connectToPrinter(p));
        }
      } catch (e) {
        console.error('Failed to load printers from storage', e);
      }
    };

    loadPrinters();

    return () => {
      // Sem reconexões nem pedidos órfãos depois do unmount.
      Object.values(reconnectTimersRef.current).forEach(timer =>
        clearTimeout(timer)
      );
      Object.values(webSocketsRef.current).forEach(ws => ws.close());
      Object.values(statusTimersRef.current).forEach(timer =>
        clearInterval(timer)
      );
      Object.values(watchdogTimersRef.current).forEach(timer =>
        clearInterval(timer)
      );
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(
        'App state changed from',
        appStateRef.current,
        'to',
        nextAppState
      );

      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log(
          'App came to foreground, reconnecting disconnected printers...'
        );
        // Fecho em segundo plano conta como recomeço: sem tentativas acumuladas.
        Object.keys(reconnectAttemptsRef.current).forEach(id => {
          delete reconnectAttemptsRef.current[id];
        });
        // Small delay to ensure app is fully active
        setTimeout(() => {
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
        console.log('App em segundo plano: ligações mantidas.');
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    const savePrinters = async () => {
      try {
        const printersToSave = printers.map(
          ({ id, printerName, ipAddress, mainboardId }) => ({
            id,
            printerName,
            ipAddress,
            mainboardId,
          })
        );
        await AsyncStorage.setItem('printers', JSON.stringify(printersToSave));
      } catch (e) {
        console.error('Failed to save printers to storage', e);
      }
    };

    // Gravar sempre, mesmo lista vazia: senão remover a última impressora
    // deixa a lista antiga no AsyncStorage e ela volta no arranque seguinte.
    savePrinters();
  }, [printers]);

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
    console.log('Sending status request to printer', printer.printerName);
    const websocket = ws || webSocketsRef.current[printer.id];
    console.log('websocket', websocket);

    if (!websocket) {
      console.log(
        `No WebSocket found for ${printer.printerName}, stopping timer`
      );
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
      console.log(`Sending status request to ${printer.printerName}`);
      websocket.send(JSON.stringify(statusRequest));
    } else {
      console.log(
        `WebSocket not open for ${printer.printerName}, state: ${websocket.readyState}`
      );
      if (
        websocket.readyState === WebSocket.CLOSED ||
        websocket.readyState === WebSocket.CLOSING
      ) {
        console.log(
          `WebSocket closed for ${printer.printerName}, stopping timer`
        );
        stopStatusTimer(printer.id);
        updatePrinterStatus(printer.id, 'disconnected');
      }
    }
  };

  const startStatusTimer = (printer: Printer) => {
    console.log(
      `Starting status timer for ${printer.printerName} (${printer.id})`
    );

    // Clear any existing timer for this printer
    if (statusTimersRef.current[printer.id]) {
      console.log(`Clearing existing timer for ${printer.id}`);
      clearInterval(statusTimersRef.current[printer.id]);
    }

    // Start a new timer
    const timer = setInterval(() => {
      console.log(`Timer tick for ${printer.printerName}`);
      // Check if printer is still connected before sending - use ref to get current state
      const currentPrinter = printersRef.current.find(p => p.id === printer.id);
      console.log('Current printers from ref:', printersRef.current);
      if (currentPrinter && currentPrinter.connectionStatus === 'connected') {
        sendStatusRequest(printer);
      } else {
        console.log(
          `Printer ${printer.printerName} is not connected, stopping timer`
        );
        stopStatusTimer(printer.id);
      }
    }, statusIntervalRef.current);

    console.log(`Created timer ${timer} for ${printer.id}`);
    statusTimersRef.current[printer.id] = timer;
    console.log(`Updated timers:`, Object.keys(statusTimersRef.current));
  };

  const stopStatusTimer = (printerId: string) => {
    console.log(`Attempting to stop status timer for printer ${printerId}`);
    console.log(`Current status timers:`, Object.keys(statusTimersRef.current));

    if (statusTimersRef.current[printerId]) {
      console.log(`Found timer for ${printerId}, clearing it`);
      clearInterval(statusTimersRef.current[printerId]);
      delete statusTimersRef.current[printerId];
      console.log(
        `Updated timers after removal:`,
        Object.keys(statusTimersRef.current)
      );
    } else {
      console.log(`No timer found for ${printerId}`);
    }
  };

  const ipHealRef = useRef<{ [key: string]: number }>({});

  /**
   * The printer gets its address from DHCP, so it can come back on a different
   * IP after a reboot. When a connection drops, rescan the network once a
   * minute and reconnect silently if the same machine answers elsewhere.
   */
  const healPrinterIp = async (printer: Printer) => {
    const lastAttempt = ipHealRef.current[printer.id] ?? 0;
    if (Date.now() - lastAttempt < 60000) {
      return;
    }
    ipHealRef.current[printer.id] = Date.now();

    try {
      const discovered = await discoverPrinters();
      const match = discovered.find(
        d =>
          (!!printer.mainboardId && d.mainboardId === printer.mainboardId) ||
          d.name.trim().toLowerCase() ===
            printer.printerName.trim().toLowerCase()
      );

      if (match && match.ip !== printer.ipAddress) {
        console.log(
          `Auto-healed ${printer.printerName}: ${printer.ipAddress} -> ${match.ip}`
        );
        updatePrinterIp(printer.id, match.ip);
      }
    } catch (error) {
      console.log('Auto IP heal failed', error);
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
    console.log(
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
      console.log(
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

  const connectToPrinter = (printer: Printer) => {
    // If a websocket for this printer already exists, close it before creating a new one.
    if (webSocketsRef.current[printer.id]) {
      markIntentionalClose(printer.id);
      webSocketsRef.current[printer.id].close();
    }
    clearReconnectTimer(printer.id);
    intentionalCloseRef.current[printer.id] = false;

    updatePrinterStatus(printer.id, 'connecting');
    const ws = new WebSocket(`ws://${printer.ipAddress}/websocket`);

    const timeout = setTimeout(() => {
      console.log(`Connection to ${printer.printerName} timed out.`);
      updatePrinterStatus(printer.id, 'timeout');
      ws.close();
      healPrinterIp(printer);
    }, CONNECTION_TIMEOUT);

    ws.onopen = () => {
      clearTimeout(timeout);
      console.log(`Connected to printer: ${printer.printerName}`);
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
      console.log(
        `Sending enable command to ${printer.printerName}:`,
        enableCommand
      );
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
          pending.resolve(data?.Data?.Data ?? {});
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
          console.log(
            `Status update from ${printer.printerName}:`,
            data.Status
          );
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
            console.log('VideoUrl', data.Data.Data.VideoUrl);
            updatePrinterVideoUrl(printer.id, data.Data.Data.VideoUrl);
          }
          console.log(`ACK received from ${printer.printerName}`);
          // Send status request using the ws instance directly
          sendStatusRequest(printer, ws);
        }
        if (data.Data && data.Data.Data && data.Data.Data.Ack > 0) {
          console.log(`ACK non zero received from ${printer.printerName}`);
          const requestId = data.Data.RequestID;
          const commandName =
            pendingCommandsRef.current[requestId]?.command || 'comando';

          // Remove from pending commands
          delete pendingCommandsRef.current[requestId];

          // Mensagem honesta e em português: o código Ack é o que a máquina
          // devolveu, sem inventar causas que não foram observadas.
          const aviso = descreverAck(
            data.Data.Data.Ack as number,
            commandName
          );
          Alert.alert(aviso.titulo, aviso.mensagem, [{ text: 'OK' }]);
        }
      } catch (error) {
        console.log(
          `Error parsing message from ${printer.printerName}:`,
          error
        );
        console.log(`Raw message:`, event.data);
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
      console.log(
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
    mainboardId?: string
  ) => {
    const newPrinter: Printer = {
      id: generateId(),
      printerName,
      ipAddress,
      connectionStatus: 'connecting',
      mainboardId,
    };

    setPrinters(prevPrinters => {
      const existingPrinter = prevPrinters.find(p => p.ipAddress === ipAddress);
      if (existingPrinter) {
        // Maybe alert the user that the printer already exists
        console.log('printer already exists', existingPrinter);
        return prevPrinters;
      }
      const updatedPrinters = [...prevPrinters, newPrinter];
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });

    connectToPrinter(newPrinter);
  };

  const removePrinter = (id: string) => {
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
    console.log('remove printer', id);
    setPrinters(prevPrinters => {
      const updatedPrinters = prevPrinters.filter(p => p.id !== id);
      printersRef.current = updatedPrinters;
      return updatedPrinters;
    });
    // A gravação fica a cargo do efeito que observa `printers` (uma só
    // escrita, sem corrida com o get/set manual que aqui existia).
  };

  const updatePrinterIp = (id: string, ipAddress: string) => {
    const printer = printersRef.current.find(p => p.id === id);
    if (!printer || printer.ipAddress === ipAddress) {
      return;
    }

    console.log(
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
        console.log('Failed to close old socket', e);
      }
      delete webSocketsRef.current[id];
    }
    stopStatusTimer(id);

    const updatedPrinter: Printer = {
      ...printer,
      ipAddress,
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
        const ws = webSocketsRef.current[printerId];
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new PrinterOfflineError());
          return;
        }
        const printer = printersRef.current.find(item => item.id === printerId);
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
              TimeStamp: Math.floor(Date.now() / 1000),
              From: 1,
            },
          })
        );
      }),
    []
  );

  const sendCommand = (printerId: string, command: SdcpCommand<unknown>) => {
    // Erro de programação: rejeita já, sem tocar na rede.
    if (!isSdcpCommand(command)) {
      throw new CommandValidationError(
        'Comando SDCP inválido: tem de vir de um construtor de src/utils/commands.ts.'
      );
    }
    const ws = webSocketsRef.current[printerId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`Sending command to printer ${printerId}:`, command);

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
    console.log('Reconnecting to all printers...');
    // Reconexão manual recomeça o ciclo de tentativas.
    printers.forEach(printer => {
      delete reconnectAttemptsRef.current[printer.id];
      connectToPrinter(printer);
    });
  };

  const reconnectDisconnectedPrinters = () => {
    console.log('Reconnecting only disconnected printers...');
    console.log(
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
      console.log(
        `Found ${disconnectedPrinters.length} disconnected printers, reconnecting...`
      );
      disconnectedPrinters.forEach(printer => {
        console.log(
          `Attempting to reconnect to ${printer.printerName} (${printer.connectionStatus})`
        );
        // Volta ao primeiro plano: ciclo de tentativas recomeça.
        delete reconnectAttemptsRef.current[printer.id];
        connectToPrinter(printer);
      });
    } else {
      console.log('All printers are connected, no need to reconnect');
    }
  };

  const updateStatusInterval = useCallback(
    async (ms: number) => {
      statusIntervalRef.current = ms;
      setStatusIntervalMs(ms);
      try {
        await AsyncStorage.setItem('statusIntervalMs', String(ms));
      } catch (error) {
        console.log('could not save status interval', error);
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
