/**
 * Único ponto de saída HTTP em claro. A app fala com impressoras por IP privado
 * (LAN, Tailscale) e o `network_security_config` deixa passar cleartext para
 * qualquer host — por isso a garantia tem de estar aqui: nada sai para fora da
 * rede privada, nem por redireccionamento.
 *
 * PONYTAIL: o `fetch` do React Native é `whatwg-fetch` sobre o XHR nativo e
 * ignora `redirect: 'manual'` (verificado no código do RN 0.79: o polyfill não
 * lê essa opção e o OkHttp segue por omissão). Por isso o JSON em Android vai
 * pelo módulo nativo `HttpLocal` (HttpURLConnection com
 * instanceFollowRedirects=false) e o salto é decidido em JS. O caminho `fetch`
 * abaixo fica só como recurso fora do Android: continua **por verificar**.
 */

/** RFC1918 + loopback + CGNAT do Tailscale (100.64.0.0/10) + nomes locais. */
export const hostPrivado = (endereco: string): boolean => {
  const host = endereco
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.ts.net')
  ) {
    return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 100 && b >= 64 && b <= 127)
  );
};

/** Destino de um redireccionamento continua dentro da rede privada? */
export const destinoPermitido = (
  atual: string,
  localizacao: string
): boolean => {
  try {
    return hostPrivado(new URL(localizacao, atual).toString());
  } catch {
    return false;
  }
};

export const SALTO_MAX = 3;

/**
 * GET/POST com prazo e sem sair da rede privada. Segue redireccionamentos à mão
 * (até [SALTO_MAX]) e recusa os que apontem para fora.
 */
export const pedirLocal = async (
  url: string,
  init: RequestInit = {},
  tempoLimite = 4000
): Promise<Response> => {
  if (!hostPrivado(url)) throw new Error('host_fora_da_rede');
  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), tempoLimite);
  try {
    let atual = url;
    let resposta = await fetch(atual, {
      ...init,
      redirect: 'manual',
      signal: controlador.signal,
    });
    for (let salto = 0; salto < SALTO_MAX; salto += 1) {
      if (resposta.status < 300 || resposta.status >= 400) return resposta;
      const localizacao = resposta.headers.get('location');
      if (!localizacao) return resposta;
      if (!destinoPermitido(atual, localizacao)) {
        throw new Error('redirect_fora_da_rede');
      }
      atual = new URL(localizacao, atual).toString();
      resposta = await fetch(atual, {
        ...init,
        redirect: 'manual',
        signal: controlador.signal,
      });
    }
    return resposta;
  } finally {
    clearTimeout(relogio);
  }
};

export const pedirJsonLocal = async (
  url: string,
  tempoLimite = 4000
): Promise<any> => {
  // `require` preguiçoso: importar 'react-native' no topo quebra o Jest (ESM).
  const nativo = (() => {
    try {
      return require('react-native').NativeModules?.HttpLocal;
    } catch {
      return undefined;
    }
  })();
  // Android: o salto é decidido aqui porque o módulo nativo não segue o 302
  // (HttpURLConnection com instanceFollowRedirects=false).
  if (nativo?.pedirJson) {
    let atual = url;
    for (let salto = 0; salto <= SALTO_MAX; salto += 1) {
      if (!hostPrivado(atual)) throw new Error('host_fora_da_rede');
      const r = await nativo.pedirJson(atual, tempoLimite);
      if (r.status < 300 || r.status >= 400)
        return JSON.parse(r.body || 'null');
      if (!r.location) throw new Error('redirect_sem_destino');
      if (!destinoPermitido(atual, r.location)) {
        throw new Error('redirect_fora_da_rede');
      }
      atual = new URL(r.location, atual).toString();
    }
    throw new Error('demasiados_redireccionamentos');
  }
  return (await pedirLocal(url, {}, tempoLimite)).json();
};
