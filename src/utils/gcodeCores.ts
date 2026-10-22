/**
 * Leitura das cores/filamentos declarados no cabeçalho de um G-code do Orca.
 *
 * O CC1 não publica os slots do CANVAS no protocolo SDCP (só `AmsConnectStatus`),
 * por isso a única fonte fiável do que o ficheiro vai usar são os comentários que
 * o fatiador escreve no início do ficheiro:
 *
 *   ; filament_colour = #af7832;#077747
 *   ; filament used [g] = 1.53, 0.00
 *   ; filament_type = PLA;PETG
 *   ; filament_settings_id = "Elegoo PLA @ECC";"Elegoo PLA @ECC"
 */

export interface FilamentoDoFicheiro {
  /** Índice da ferramenta no ficheiro: T0, T1, ... */
  tool: number;
  /** Cor em `#rrggbb`, quando o fatiador a declarou. */
  cor?: string;
  /** Gramas estimadas para esta ferramenta. */
  gramas: number;
  /** Tipo de material (PLA, PETG, ...). */
  tipo?: string;
}

// O Orca separa as cores com `;` e os consumos com `,` — aceitam-se ambos.
const separar = (valor: string): string[] =>
  valor.split(/[;,]/).map(parte => parte.trim());

const numero = (valor: string): number => {
  const limpo = Number.parseFloat(valor.replace(',', '.'));
  return Number.isFinite(limpo) ? limpo : 0;
};

/** Aceita `#rgb`, `#rrggbb` e devolve sempre `#rrggbb` (ou undefined). */
export const normalizarCor = (valor?: string): string | undefined => {
  if (!valor) return undefined;
  const hex = valor.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map(c => c + c)
      .join('')
      .toLowerCase()}`;
  }
  return undefined;
};

/**
 * Extrai os filamentos usados a partir das primeiras linhas do ficheiro.
 * Só devolve as ferramentas com consumo maior que zero — as outras são slots
 * vazios que o fatiador declarou por omissão.
 */
export const filamentosDoCabecalho = (
  gcode: string
): FilamentoDoFicheiro[] => {
  // O bloco de configuração do Orca não está no início do ficheiro: vem depois
  // da miniatura embutida, pelo que é preciso varrer o texto todo. Fica-se com
  // a última ocorrência de cada chave.
  const ultimo = (chave: string): string[] => {
    const padrao = new RegExp(`^;\\s*(?:${chave})\\s*=\\s*(.+)$`, 'gim');
    let valor: string[] = [];
    let encontrado: RegExpExecArray | null;
    while ((encontrado = padrao.exec(gcode)) !== null) {
      valor = separar(encontrado[1]);
    }
    return valor;
  };

  const cores = ultimo('filament_colour|filament_color');
  const gramas = ultimo('filament used \\[g\\]');
  const tipos = ultimo('filament_type').map(parte =>
    parte.replace(/^"|"$/g, '')
  );

  const total = Math.max(cores.length, gramas.length, tipos.length);
  const resultado: FilamentoDoFicheiro[] = [];
  for (let tool = 0; tool < total; tool += 1) {
    const peso = numero(gramas[tool] ?? '0');
    if (peso <= 0) continue;
    resultado.push({
      tool,
      cor: normalizarCor(cores[tool]),
      gramas: Math.round(peso * 100) / 100,
      tipo: tipos[tool] || undefined,
    });
  }
  return resultado;
};

/** true quando o ficheiro usa mais do que uma ferramenta. */
export const eMulticolor = (filamentos: FilamentoDoFicheiro[]): boolean =>
  filamentos.length > 1;

// ---------------------------------------------------------------------------
// Consumo de filamento
// ---------------------------------------------------------------------------

const DENSIDADES: Record<string, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  TPU: 1.21,
  PA: 1.14,
  PC: 1.21,
};

export interface Consumo {
  gramas: number;
  metros: number;
  material: string;
}

/** Lê o material do cabeçalho; sem pista, assume PLA. */
export const materialDoCabecalho = (texto: string): string => {
  const achado = texto.match(/filament_type\s*[=:]\s*([A-Za-z+]+)/i);
  const bruto = achado?.[1]?.toUpperCase();
  if (bruto && DENSIDADES[bruto]) return bruto;
  return 'PLA';
};

/**
 * Soma o filamento extrudido no G-code (só o E, não as viagens).
 * Valor estimado: retrações e purgas entram no cálculo com o sinal real.
 */
export const consumoDoGcode = (texto: string, diametro = 1.75): Consumo => {
  const material = materialDoCabecalho(texto);
  const densidade = DENSIDADES[material] ?? 1.24;
  let absoluto = true;
  let ultimoE = 0;
  let total = 0;

  for (const linha of texto.split('\n')) {
    if (linha.startsWith('M82')) {
      absoluto = true;
      continue;
    }
    if (linha.startsWith('M83')) {
      absoluto = false;
      continue;
    }
    const e = linha.indexOf('E');
    if (e === -1 || linha.indexOf('G1') !== 0) continue;
    // Só interessa quando há movimento de extrusão.
    const valor = Number.parseFloat(linha.slice(e + 1));
    if (!Number.isFinite(valor)) continue;
    if (absoluto) {
      total += valor - ultimoE;
      ultimoE = valor;
    } else {
      total += valor;
    }
  }

  const area = Math.PI * (diametro / 2) ** 2; // mm²
  const mm = Math.max(total, 0);
  const cm3 = (mm * area) / 1000;
  return {
    gramas: cm3 * densidade,
    metros: mm / 1000,
    material,
  };
};
