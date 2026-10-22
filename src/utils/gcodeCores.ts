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
