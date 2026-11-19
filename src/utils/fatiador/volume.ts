/**
 * Regras do visor [E1B] do fatiador: o modelo cabe no volume útil da máquina?
 *
 * Puro e sem React: os quatro estados são independentes e cada um tem uma
 * consequência própria — bloquear, avisar e permitir, ou bloquear por falta
 * de dados. Nunca se assume um volume fixo: vem do perfil da máquina.
 */

export type Dimensoes = { x: number; y: number; z: number };

/** Volume útil em mm, lido do perfil (printable_area + printable_height). */
export type VolumeUtil = Dimensoes | null;

export type EstadoVolume =
  | 'cabe'
  | 'excede'
  | 'volumeIndisponivel'
  | 'dimensoesDesconhecidas';

export type AvaliacaoVolume = {
  estado: EstadoVolume;
  /** Só o fatiar é bloqueado; os avisos continuam a permitir avançar. */
  bloqueia: boolean;
};

const valido = (v: number | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

export const avaliarVolume = (
  dimensoes: Dimensoes | null | undefined,
  volume: VolumeUtil
): AvaliacaoVolume => {
  if (
    !dimensoes ||
    !valido(dimensoes.x) ||
    !valido(dimensoes.y) ||
    !valido(dimensoes.z)
  ) {
    return { estado: 'dimensoesDesconhecidas', bloqueia: true };
  }
  if (!volume || !valido(volume.x) || !valido(volume.y) || !valido(volume.z)) {
    return { estado: 'volumeIndisponivel', bloqueia: false };
  }
  const excede =
    dimensoes.x > volume.x || dimensoes.y > volume.y || dimensoes.z > volume.z;
  return excede
    ? { estado: 'excede', bloqueia: true }
    : { estado: 'cabe', bloqueia: false };
};

/**
 * Caixa envolvente de um STL binário. Devolve null se o ficheiro não for um
 * STL binário válido — cabe ao ecrã mostrar `dimensoesDesconhecidas`.
 *
 * Formato de cada faceta: normal (12 B) + 3 vértices (12 B cada) + atributo
 * (2 B) = 50 bytes. Saltar a normal é obrigatório: lê-la como vértice dá
 * dimensões erradas (o bug do spike de viabilidade).
 */
export const caixaEnvolventeSTL = (
  bytes: Uint8Array
): { dimensoes: Dimensoes; triangulos: number } | null => {
  if (bytes.length < 84) return null;
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangulos = vista.getUint32(80, true);
  if (triangulos === 0 || bytes.length !== 84 + triangulos * 50) return null;

  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;

  for (let i = 0; i < triangulos; i += 1) {
    const base = 84 + i * 50 + 12;
    for (let v = 0; v < 3; v += 1) {
      const p = base + v * 12;
      const x = vista.getFloat32(p, true);
      const y = vista.getFloat32(p + 4, true);
      const z = vista.getFloat32(p + 8, true);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return null;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
  }

  return {
    dimensoes: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    triangulos,
  };
};
