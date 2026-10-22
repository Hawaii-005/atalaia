import * as FileSystem from 'expo-file-system';
import SparkMD5 from 'spark-md5';

const CHUNK_SIZE = 1024 * 1024;
const TEMPO_LIMITE_BLOCO_MS = 60000;
const uploadUrl = (ip: string) => `http://${ip}:3030/uploadFile/upload`;

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes has no Buffer and atob is not guaranteed, so decode by hand. */
const decodeBase64 = (input: string): Uint8Array => {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i]);
    const c2 = BASE64_CHARS.indexOf(clean[i + 1]);
    const c3 = BASE64_CHARS.indexOf(clean[i + 2]);
    const c4 = BASE64_CHARS.indexOf(clean[i + 3]);
    if (byteIndex < length) bytes[byteIndex++] = (c1 << 2) | (c2 >> 4);
    if (c3 >= 0 && byteIndex < length) {
      bytes[byteIndex++] = ((c2 & 15) << 4) | (c3 >> 2);
    }
    if (c4 >= 0 && byteIndex < length) {
      bytes[byteIndex++] = ((c3 & 3) << 6) | c4;
    }
  }
  return bytes;
};

const newTransferId = () => {
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i += 1) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
};

/**
 * Envia o ficheiro em blocos. `onProgresso` é chamado após cada bloco
 * aceite pela impressora, com os bytes já enviados e o total.
 */
export const uploadGcode = async (
  printerIp: string,
  uri: string,
  filename: string,
  onProgresso?: (enviado: number, total: number) => void
): Promise<void> => {
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const total = (info as { size?: number }).size ?? 0;
  if (!total) {
    throw new Error('Ficheiro vazio');
  }

  // The printer verifies the whole-file MD5 before accepting the transfer.
  const spark = new SparkMD5.ArrayBuffer();
  for (let position = 0; position < total; position += CHUNK_SIZE) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length: Math.min(CHUNK_SIZE, total - position),
    });
    const bytes = decodeBase64(base64);
    spark.append(bytes.buffer as ArrayBuffer);
  }
  const digest = spark.end();

  const transferId = newTransferId();
  let index = 0;

  for (let position = 0; position < total; position += CHUNK_SIZE) {
    const length = Math.min(CHUNK_SIZE, total - position);
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });

    const chunkUri = `${FileSystem.cacheDirectory}upload_chunk_${index}.bin`;
    await FileSystem.writeAsStringAsync(chunkUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const form = new FormData();
    form.append('TotalSize', String(total));
    form.append('Uuid', transferId);
    form.append('Offset', String(position));
    form.append('Check', '1');
    form.append('S-File-MD5', digest);
    form.append('File', {
      uri: chunkUri,
      name: filename,
      type: 'application/octet-stream',
    } as unknown as Blob);

    // Timeout: sem isto um pedido que não responde deixa o envio pendurado
    // para sempre. O ficheiro temporário sai sempre, mesmo em erro.
    const controller = new AbortController();
    const relogio = setTimeout(() => controller.abort(), TEMPO_LIMITE_BLOCO_MS);
    try {
      const response = await fetch(uploadUrl(printerIp), {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(`Falhou no byte ${position}`);
      }
    } catch (erro) {
      if (erro instanceof Error && erro.name === 'AbortError') {
        throw new Error(
          `A impressora não respondeu ao bloco do byte ${position} em 60 s`
        );
      }
      throw erro;
    } finally {
      clearTimeout(relogio);
      await FileSystem.deleteAsync(chunkUri, { idempotent: true }).catch(
        () => undefined
      );
    }

    index += 1;
    onProgresso?.(position + length, total);
  }
};
