import { log } from './log';
import * as Network from 'expo-network';
import { Buffer } from 'buffer';
import dgram from 'react-native-udp';

export interface DiscoveredPrinter {
  ip: string;
  name: string;
  firmware?: string;
  mainboardId?: string;
  /** 'fdm' = WebSocket SDCP (:3030); 'resin' = SDCP V1 sobre MQTT (UDP :3000). */
  kind: 'fdm' | 'resin';
  /** Identificador da sessão UDP, necessário para o MQTT da resina. */
  sdcpId?: string;
}

const PROBE_TIMEOUT = 1500;
const CONCURRENCY = 48;

/**
 * Asks the printer for its attributes (SDCP Cmd 1) over the local websocket.
 * A successful attributes reply means this IP really is an Elegoo printer.
 */
const probePrinter = (ip: string): Promise<DiscoveredPrinter | null> =>
  new Promise(resolve => {
    let settled = false;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (result: DiscoveredPrinter | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const current = socket;
      socket = null;
      try {
        current?.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    timer = setTimeout(() => finish(null), PROBE_TIMEOUT);

    try {
      socket = new WebSocket(`ws://${ip}:3030/websocket`);
      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            Id: 'discovery',
            Data: {
              Cmd: 1,
              Data: {},
              RequestID: 'DISCOVERY_ATTR',
              MainboardID: '',
              TimeStamp: Date.now(),
              From: 1,
            },
          })
        );
      };
      socket.onmessage = event => {
        try {
          const payload = JSON.parse(String(event.data));
          const attrs = payload?.Attributes;
          if (attrs) {
            finish({
              ip,
              name: attrs.Name || attrs.MachineName || `Printer ${ip}`,
              firmware: attrs.FirmwareVersion,
              mainboardId: attrs.MainboardID,
              kind: 'fdm',
            });
          }
        } catch {
          // Not JSON or not attributes - ignore
        }
      };
      socket.onerror = () => finish(null);
      socket.onclose = () => finish(null);
    } catch {
      finish(null);
    }
  });


const UDP_PORT = 3000;
const UDP_TIMEOUT = 2500;

/**
 * SDCP answers a UDP broadcast of "M99999" on port 3000 with its identity.
 * One datagram finds every printer on the LAN — no /24 sweep needed.
 */
const udpDiscovery = (subnet: string | null): Promise<DiscoveredPrinter[]> =>
  new Promise(resolve => {
    const found = new Map<string, DiscoveredPrinter>();
    let socket: any = null;
    let finished = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        socket?.close();
      } catch {
        // ignore
      }
      log('[discovery] udp encontrou', found.size);
      resolve(Array.from(found.values()));
    };

    try {
      socket = dgram.createSocket({ type: 'udp4' });
      socket.on('error', finish);
      socket.on('message', (data: any) => {
        try {
          const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
          const payload = JSON.parse(text);
          const info = payload?.Data ?? payload;
          // A Saturn 3 Ultra aninha tudo em Data.Attributes; a Centauri manda
          // os campos à superfície de Data. Aceitam-se as duas formas.
          const attrs = info?.Attributes ?? info;
          const ip = attrs?.MainboardIP;
          if (!ip) return;
          if (!graceTimer) {
            graceTimer = setTimeout(finish, 600);
          }
          const protocolo = String(attrs?.ProtocolVersion ?? '');
          found.set(ip, {
            ip,
            name: attrs?.MachineName || attrs?.Name || 'Impressora Elegoo',
            firmware: attrs?.FirmwareVersion,
            mainboardId: attrs?.MainboardID,
            // SDCP V1 é a família das resinas (Saturn/Mars): falam MQTT, não
            // WebSocket. A Centauri Carbon anuncia V3.
            kind: protocolo.startsWith('V1') ? 'resin' : 'fdm',
            sdcpId: payload?.Id,
          });
        } catch {
          // not ours
        }
      });

      socket.bind(0, () => {
        const targets = ['255.255.255.255'];
        if (subnet) targets.push(`${subnet}.255`);
        targets.forEach(address => {
          try {
            socket?.send('M99999', 0, 6, UDP_PORT, address, () => {});
          } catch {
            // ignore unreachable broadcast
          }
        });
      });
    } catch {
      finish();
      return;
    }

    setTimeout(finish, UDP_TIMEOUT);
  });

/** Returns the /24 prefix of the phone's Wi-Fi address, e.g. "192.168.1". */
export const getLocalSubnet = async (): Promise<string | null> => {
  try {
    const ip = await Network.getIpAddressAsync();
    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return null;
    }
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  } catch {
    return null;
  }
};

let emCurso: Promise<DiscoveredPrinter[]> | null = null;

/**
 * Descoberta barata: um único datagrama UDP, sem tocar nos 254 endereços.
 * É o que se usa para "curar" o IP quando a ligação cai — uma varredura
 * completa a cada queda é tráfego que a rede doméstica não merece.
 */
export const descobrirSoUdp = async (): Promise<DiscoveredPrinter[]> => {
  const subnet = await getLocalSubnet();
  return udpDiscovery(subnet);
};

/**
 * Sweeps the local /24 for printers listening on the SDCP port (3030).
 * Runs in batches so the phone is not asked to open 254 sockets at once.
 * Só uma varredura de cada vez: chamadas simultâneas partilham o resultado.
 */
export const discoverPrinters = async (
  onProgress?: (scanned: number, total: number) => void
): Promise<DiscoveredPrinter[]> => {
  if (emCurso) {
    return emCurso;
  }
  emCurso = descobrirComVarredura(onProgress).finally(() => {
    emCurso = null;
  });
  return emCurso;
};

const descobrirComVarredura = async (
  onProgress?: (scanned: number, total: number) => void
): Promise<DiscoveredPrinter[]> => {
  const subnet = await getLocalSubnet();
  if (!subnet) {
    throw new Error(
      'Não consegui ler o endereço do Wi-Fi. Confirma que o telemóvel está na mesma rede da impressora.'
    );
  }

  const viaUdp = await udpDiscovery(subnet);
  if (viaUdp.length > 0) {
    onProgress?.(254, 254);
    return viaUdp;
  }

  const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
  const found: DiscoveredPrinter[] = [];
  let scanned = 0;

  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const batch = hosts.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(ip => probePrinter(ip)));
    results.forEach(result => {
      if (result) {
        found.push(result);
      }
    });
    scanned += batch.length;
    onProgress?.(scanned, hosts.length);
  }

  return found;
};
