/**
 * Leitura de camadas do G-code, para a pré-visualização 2D do detalhe.
 *
 * O objetivo é honesto e limitado: mostrar a vista de cima de **uma** camada
 * de cada vez, só os movimentos que extrudem. Não é um fatiador nem um
 * visualizador 3D — não há suporte, preenchimentos ocos, retrações nem
 * deslocações (esses movimentos ficam de fora e é por isso que a imagem tem
 * vazios entre paredes, como deve ter).
 *
 * Regras que valem a pena saber:
 * - Uma camada só muda quando há **extrusão** a uma altura maior. Assim, o
 *   Z-hop com retração (sobe, viaja, desce) não cria camadas falsas.
 * - Se o ficheiro tiver marcadores `;LAYER_CHANGE` (Orca/ElegooSlicer), são
 *   eles que mandam; só se não houver marcadores se usa a altura.
 * - O consumo de memória é limitado: cada segmento são 4 números em
 *   `Float32Array` e há um teto global de segmentos.
 */

export interface CamadaGcode {
  /** Altura da camada em mm. */
  z: number;
  /** x1,y1,x2,y2,… em mm, no sistema da impressora. */
  segmentos: Float32Array;
  /** Índice do filamento quando houve mudança de cor antes desta camada. */
  cor: number | null;
}

export interface LimitesCamadas {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CamadasGcode {
  camadas: CamadaGcode[];
  limites: LimitesCamadas;
  /** O ficheiro era maior do que o teto: a pré-visualização fica incompleta. */
  truncado: boolean;
  /** O ficheiro trazia marcadores de camada (mais fiáveis que a altura). */
  comMarcadores: boolean;
}

/** Teto de segmentos: ~6,4 MB só nos traços. */
export const LIMITE_SEGMENTOS = 400_000;

/** Teto de leitura do ficheiro: acima disto não se tenta. */
export const LIMITE_BYTES = 6_000_000;

const NUMERO = /([A-Z])(-?\d*\.?\d+)/g;
const MARCADOR_CAMADA = /^;\s*(LAYER_CHANGE|CHANGE_LAYER)\b/i;

const Z_MINIMO = 0.05; // mm: abaixo disto é ruído de arredondamento
const PASSO_ARCO = 10; // segmentos por arco, suficiente para ver a forma

interface EmCurso {
  z: number;
  segmentos: number[];
  cor: number | null;
}

export const lerCamadas = (
  gcode: string,
  limiteSegmentos = LIMITE_SEGMENTOS
): CamadasGcode => {
  const camadas: CamadaGcode[] = [];
  const comMarcadores = /^;\s*(LAYER_CHANGE|CHANGE_LAYER)\b/im.test(gcode);

  let x = 0;
  let y = 0;
  let z = 0;
  let e = 0;
  let relativo = false;
  let cor = 0;
  let corPendente: number | null = null;
  let totalSegmentos = 0;
  let truncado = false;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Guardado num objeto: o TypeScript não segue atribuições feitas dentro de
  // funções auxiliares e assumiria que isto fica sempre `null`.
  const estado: { atual: EmCurso | null } = { atual: null };

  const fechar = () => {
    // Camadas com meia dúzia de traços são lixo (wipe, purga no canto).
    const c = estado.atual;
    if (c && c.segmentos.length >= 8) {
      camadas.push({
        z: c.z,
        segmentos: Float32Array.from(c.segmentos),
        cor: c.cor,
      });
    }
    estado.atual = null;
  };

  const abrir = () => {
    estado.atual = { z, segmentos: [], cor: corPendente };
    corPendente = null;
  };

  const acrescentar = (x1: number, y1: number) => {
    if (!estado.atual) abrir();
    const atual = estado.atual;
    if (!atual) return;
    atual.segmentos.push(x, y, x1, y1);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x1 < minX) minX = x1;
    if (x1 > maxX) maxX = x1;
    if (y1 < minY) minY = y1;
    if (y1 > maxY) maxY = y1;
    totalSegmentos += 1;
  };

  const linhas = gcode.split('\n');
  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) continue;

    if (linha.startsWith(';')) {
      if (comMarcadores && MARCADOR_CAMADA.test(linha)) fechar();
      continue;
    }

    const comando = linha.split(' ')[0];

    if (comando === 'M82') {
      relativo = false;
      continue;
    }
    if (comando === 'M83') {
      relativo = true;
      continue;
    }
    if (comando === 'M600') {
      // Mudança de cor manual: a próxima camada é a primeira da cor nova.
      cor += 1;
      corPendente = cor;
      continue;
    }
    if (/^T\d+$/.test(comando)) {
      cor = Number(comando.slice(1));
      corPendente = cor;
      continue;
    }

    if (
      comando !== 'G1' &&
      comando !== 'G0' &&
      comando !== 'G2' &&
      comando !== 'G3'
    )
      continue;

    let nx = x;
    let ny = y;
    let nz = z;
    let ne = e;
    let i = 0;
    let j = 0;
    NUMERO.lastIndex = 0;
    let m = NUMERO.exec(linha);
    while (m) {
      const valor = Number(m[2]);
      if (m[1] === 'X') nx = valor;
      else if (m[1] === 'Y') ny = valor;
      else if (m[1] === 'Z') nz = valor;
      else if (m[1] === 'E') ne = valor;
      else if (m[1] === 'I') i = valor;
      else if (m[1] === 'J') j = valor;
      m = NUMERO.exec(linha);
    }

    const temEExtrudindo = relativo ? ne > 0 : ne > e;
    const desloca = nx !== x || ny !== y;
    const arco = comando === 'G2' || comando === 'G3';

    if (temEExtrudindo && desloca) {
      const corrente = estado.atual;
      if (!comMarcadores && (!corrente || nz > corrente.z + Z_MINIMO)) {
        fechar();
        z = nz;
        abrir();
      }
      if (!estado.atual) {
        z = nz;
        abrir();
      }

      if (arco) {
        const cx = x + i;
        const cy = y + j;
        const r = Math.hypot(x - cx, y - cy);
        if (r > 0) {
          const a0 = Math.atan2(y - cy, x - cx);
          let a1 = Math.atan2(ny - cy, nx - cx);
          if (comando === 'G2') {
            while (a1 > a0) a1 -= Math.PI * 2;
          } else {
            while (a1 < a0) a1 += Math.PI * 2;
          }
          let ax = x;
          let ay = y;
          for (let k = 1; k <= PASSO_ARCO; k += 1) {
            const a = a0 + ((a1 - a0) * k) / PASSO_ARCO;
            const bx = cx + r * Math.cos(a);
            const by = cy + r * Math.sin(a);
            x = ax;
            y = ay;
            acrescentar(bx, by);
            ax = bx;
            ay = by;
          }
        } else {
          acrescentar(nx, ny);
        }
      } else {
        acrescentar(nx, ny);
      }

      if (totalSegmentos >= limiteSegmentos) {
        truncado = true;
        x = nx;
        y = ny;
        z = nz;
        break;
      }
    }

    x = nx;
    y = ny;
    z = nz;
    e = ne;
  }

  fechar();

  return {
    camadas,
    limites: {
      minX: isFinite(minX) ? minX : 0,
      minY: isFinite(minY) ? minY : 0,
      maxX: isFinite(maxX) ? maxX : 1,
      maxY: isFinite(maxY) ? maxY : 1,
    },
    truncado,
    comMarcadores,
  };
};

/** Área de desenho, em unidades do viewBox (os píxeis do ecrã). */
export type AreaDesenho = { largura: number; altura: number };

/**
 * Converte uma camada num `d` de SVG que enche a área de desenho, mantendo a
 * proporção e centrado. A área é a do próprio ecrã: num tablet em paisagem o
 * desenho aproveita a largura toda em vez de ficar num quadrado ao meio.
 * Levanta o traço quando há deslocação entre segmentos — sem isto, paredes
 * separadas ficavam ligadas por riscos.
 */
export const caminhoDaCamada = (
  camada: CamadaGcode,
  limites: LimitesCamadas,
  area: AreaDesenho = { largura: 100, altura: 100 },
  margem = 4
): string => {
  const largura = Math.max(limites.maxX - limites.minX, 0.001);
  const altura = Math.max(limites.maxY - limites.minY, 0.001);
  const escala = Math.min(
    (area.largura - 2 * margem) / largura,
    (area.altura - 2 * margem) / altura
  );
  const desvioX = (area.largura - largura * escala) / 2;
  const desvioY = (area.altura - altura * escala) / 2;

  const px = (v: number) => (v - limites.minX) * escala + desvioX;
  const py = (v: number) =>
    area.altura - ((v - limites.minY) * escala + desvioY);

  const s = camada.segmentos;
  let d = '';
  let ultimoX: number | null = null;
  let ultimoY: number | null = null;

  for (let k = 0; k < s.length; k += 4) {
    const x1 = px(s[k]);
    const y1 = py(s[k + 1]);
    const x2 = px(s[k + 2]);
    const y2 = py(s[k + 3]);
    const salto =
      ultimoX === null ||
      Math.abs(ultimoX - x1) > 0.02 ||
      Math.abs(ultimoY! - y1) > 0.02;
    d += `${salto ? 'M' : 'L'}${x1.toFixed(2)} ${y1.toFixed(2)} `;
    d += `L${x2.toFixed(2)} ${y2.toFixed(2)} `;
    ultimoX = x2;
    ultimoY = y2;
  }

  return d.trim();
};

/**
 * Limites da peça para o desenho.
 *
 * O ficheiro real da Centauri começa com uma linha de purga no canto do
 * tabuleiro (e só na primeira camada). Com os limites de todas as camadas,
 * essa linha estica a caixa e a peça fica encolhida num canto. Aqui as
 * primeiras camadas ficam de fora — são as da purga e do rafts — e a caixa é
 * a da peça. Num ficheiro com poucas camadas usa-se tudo, que não há como
 * distinguir.
 */
export const limitesDoObjeto = (
  camadas: CamadaGcode[],
  saltarPrimeiras = 3
): LimitesCamadas => {
  const usadas =
    camadas.length > saltarPrimeiras + 1
      ? camadas.slice(saltarPrimeiras)
      : camadas;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  usadas.forEach(c => {
    const s = c.segmentos;
    for (let k = 0; k < s.length; k += 4) {
      if (s[k] < minX) minX = s[k];
      if (s[k] > maxX) maxX = s[k];
      if (s[k + 1] < minY) minY = s[k + 1];
      if (s[k + 1] > maxY) maxY = s[k + 1];
    }
  });

  if (!isFinite(minX) || !isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }

  return {
    minX,
    minY,
    maxX: Math.max(maxX, minX + 0.001),
    maxY: Math.max(maxY, minY + 0.001),
  };
};

/** Alturas das camadas, para mostrar a altura usada. */
export const alturaDaCamada = (
  camadas: CamadaGcode[],
  indice: number
): number => {
  const atual = camadas[indice];
  if (!atual) return 0;
  const anterior = camadas[indice - 1];
  return anterior ? atual.z - anterior.z : atual.z;
};

/** Cores por que passa a peça (para o resumo do ecrã de camadas). */
export const coresDasCamadas = (camadas: CamadaGcode[]): number => {
  // O índice da cor é o filamento: 0 é a primeira e não aparece como
  // «mudança». A contagem é o maior índice usado mais um.
  let usadas = 1;
  camadas.forEach(c => {
    if (c.cor !== null) usadas = Math.max(usadas, c.cor + 1);
  });
  return usadas;
};
