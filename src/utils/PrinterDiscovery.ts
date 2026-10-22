import * as Network from 'expo-network';

export interface DiscoveredPrinter {
  ip: string;
  name: string;
  firmware?: string;
  mainboardId?: string;
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

/**
 * Sweeps the local /24 for printers listening on the SDCP port (3030).
 * Runs in batches so the phone is not asked to open 254 sockets at once.
 */
export const discoverPrinters = async (
  onProgress?: (scanned: number, total: number) => void
): Promise<DiscoveredPrinter[]> => {
  const subnet = await getLocalSubnet();
  if (!subnet) {
    throw new Error(
      'Could not read your Wi-Fi address. Make sure the phone is on the same Wi-Fi as the printer.'
    );
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
