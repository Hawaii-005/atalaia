import { log } from '../utils/log';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Consumo,
  FilamentoDoFicheiro,
  consumoDoGcode,
  filamentosDoCabecalho,
} from '../utils/gcodeCores';

export interface GcodePreview {
  path: string;
  points: number;
}

const MAX_BYTES = 6_000_000;
const MAX_POINTS = 4000;
const MAX_RAW_POINTS = 200_000;
const JUMP = 6; // % do lado maior: acima disto é deslocação, não extrusão

const num = (map: Record<string, string>, key: string, fallback: number) =>
  map[key] === undefined ? fallback : Number(map[key]);

/**
 * Renders a top-down silhouette of the toolpath.
 * Handles both straight extrusion moves (G1 + E) and arc moves (G2/G3 + I/J + E),
 * which is what ElegooSlicer emits on the Centauri Carbon.
 */
export const parseToolpath = (gcode: string): GcodePreview | null => {
  const points: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;

  const pushArc = (
    cx: number,
    cy: number,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    clockwise: boolean
  ) => {
    const r = Math.hypot(sx - cx, sy - cy);
    if (!r || !isFinite(r)) {
      points.push({ x: ex, y: ey });
      return;
    }
    const a0 = Math.atan2(sy - cy, sx - cx);
    let a1 = Math.atan2(ey - cy, ex - cx);
    if (clockwise) {
      while (a1 > a0) a1 -= Math.PI * 2;
    } else {
      while (a1 < a0) a1 += Math.PI * 2;
    }
    const steps = 8;
    for (let i = 1; i <= steps; i += 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };

  const lines = gcode.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('G1') && !line.startsWith('G2') && !line.startsWith('G3')) {
      continue;
    }
    const map: Record<string, string> = {};
    const re = /([XYZEIJ])(-?\d*\.?\d+)/g;
    let m = re.exec(line);
    while (m) {
      map[m[1]] = m[2];
      m = re.exec(line);
    }

    const nx = num(map, 'X', x);
    const ny = num(map, 'Y', y);
    const extruding = map.E !== undefined && Number(map.E) > 0;

    if (line.startsWith('G1')) {
      if (extruding && points.length < MAX_RAW_POINTS) points.push({ x: nx, y: ny });
    } else if (extruding) {
      pushArc(
        x + num(map, 'I', 0),
        y + num(map, 'J', 0),
        x,
        y,
        nx,
        ny,
        line.startsWith('G2')
      );
    }
    x = nx;
    y = ny;
  }

  if (points.length < 20) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const step = Math.max(1, Math.floor(points.length / MAX_POINTS));
  const sampled = points.filter((_, index) => index % step === 0);

  let path = '';
  let lastX: number | null = null;
  let lastY: number | null = null;
  sampled.forEach(point => {
    const px = ((point.x - minX) / width) * 100;
    const py = (1 - (point.y - minY) / height) * 100;
    const jump =
      lastX === null || lastY === null || Math.hypot(px - lastX, py - lastY) > JUMP;
    path += `${jump ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)} `;
    lastX = px;
    lastY = py;
  });

  return { path: path.trim(), points: sampled.length };
};


// O servidor da impressora é pequeno: descarregar 20 ficheiros em paralelo
// satura-o e a lista deixa de responder. Fila com dois de cada vez.
const MAX_SIMULTANEOS = 2;
let ativos = 0;
const espera: (() => void)[] = [];

const comVez = async <T,>(tarefa: () => Promise<T>): Promise<T> => {
  if (ativos >= MAX_SIMULTANEOS) {
    await new Promise<void>(resolve => espera.push(resolve));
  }
  ativos += 1;
  try {
    return await tarefa();
  } finally {
    ativos -= 1;
    const proximo = espera.shift();
    if (proximo) proximo();
  }
};

const buildLocalUrl = (printerIp: string, filename: string) => {
  const clean = filename.replace(/^\/?(local\/)?\/?/, '').replace(/^\//, '');
  return `http://${printerIp}:3030/local/${encodeURIComponent(clean)}`;
};

export const useGcodePreview = (
  printerIp?: string,
  filename?: string
): {
  preview: GcodePreview | null;
  filamentos: FilamentoDoFicheiro[];
  consumo: Consumo | null;
  loading: boolean;
} => {
  const [preview, setPreview] = useState<GcodePreview | null>(null);
  const [filamentos, setFilamentos] = useState<FilamentoDoFicheiro[]>([]);
  const [consumo, setConsumo] = useState<Consumo | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<
    Record<
      string,
      {
        preview: GcodePreview | null;
        filamentos: FilamentoDoFicheiro[];
        consumo: Consumo | null;
      }
    >
  >({});

  const url = useMemo(() => {
    if (!printerIp || !filename) return '';
    return buildLocalUrl(printerIp, filename);
  }, [printerIp, filename]);

  const load = useCallback(async (cancelado: { atual: boolean }) => {
    if (!url) return;
    const guardado = cacheRef.current[url];
    if (guardado !== undefined) {
      setPreview(guardado.preview);
      setFilamentos(guardado.filamentos);
      setConsumo(guardado.consumo);
      return;
    }
    setLoading(true);
    try {
      // O servidor da impressora responde 416 a pedidos Range — sem cabeçalho.
      const response = await comVez(() => fetch(url));
      if (cancelado.atual) return;
      if (!response.ok) {
        cacheRef.current[url] = { preview: null, filamentos: [], consumo: null };
        return;
      }
      const text = await response.text();
      if (cancelado.atual) return;
      const result = parseToolpath(text);
      // As cores vêm do mesmo texto: não há segundo download.
      const cores = filamentosDoCabecalho(text);
      const gasto = consumoDoGcode(text);
      cacheRef.current[url] = { preview: result, filamentos: cores, consumo: gasto };
      if (cancelado.atual) return;
      setPreview(result);
      setFilamentos(cores);
      setConsumo(gasto);
    } catch (error) {
      log('preview failed', error instanceof Error ? error.stack : String(error));
      cacheRef.current[url] = { preview: null, filamentos: [], consumo: null };
      if (cancelado.atual) return;
      setPreview(null);
      setFilamentos([]);
      setConsumo(null);
    } finally {
      if (!cancelado.atual) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // Se o ficheiro mudar a meio, o pedido antigo não pode pintar o ecrã.
    const cancelado = { atual: false };
    load(cancelado);
    return () => {
      cancelado.atual = true;
    };
  }, [load]);

  return { preview, filamentos, consumo, loading };
};
