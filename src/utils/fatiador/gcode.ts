/**
 * Validação e leitura do G-code gerado pelo motor (fatiador [E2]–[E4]).
 *
 * O motor devolve `sucesso` antes de o ficheiro estar completo — já houve um
 * ecrã a anunciar "Fatiamento concluído — 0 B" com o ficheiro a acabar de ser
 * escrito. A regra aqui é não confiar em quem chama: sem estas cinco provas o
 * resultado não é sucesso, é erro.
 */

export type MotivoInvalido =
  | 'vazio'
  | 'sem_print_start'
  | 'sem_print_end'
  | 'sem_camadas'
  | 'sem_fim';

export type GcodeResumo = {
  valido: boolean;
  motivo?: MotivoInvalido;
  bytes: number;
  camadas: number;
  /** Valores do comando PRINT_START, em °C. */
  bico: number | null;
  mesa: number | null;
  /** Filamento com que o ficheiro vai imprimir (do bloco de configuração). */
  filamento: string;
  /** Perfil de filamento aplicado, ex.: "Elegoo PLA @ECC". */
  perfilFilamento: string;
  /** Como o slicer a escreveu, ex.: "8m 43s". */
  tempo: string;
  gramas: number | null;
};

/** Últimas linhas que um ficheiro completo pode ter (o bloco de configuração é opcional). */
const MARCA_FIM = /^;\s*(CONFIG_BLOCK_END|EXECUTABLE_BLOCK_END)$/i;

const numero = (padrao: RegExp, texto: string): number | null => {
  const m = padrao.exec(texto);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};

const ultimaLinha = (texto: string): string => {
  const linhas = texto.split(/\r?\n/);
  for (let i = linhas.length - 1; i >= 0; i -= 1) {
    const l = linhas[i].trim();
    if (l) return l;
  }
  return '';
};

export const analisarGcode = (texto: string, bytes: number): GcodeResumo => {
  const base: GcodeResumo = {
    valido: false,
    bytes,
    camadas: 0,
    bico: null,
    mesa: null,
    filamento: '',
    perfilFilamento: '',
    tempo: '',
    gramas: null,
  };

  if (bytes <= 0 || texto.trim() === '') return { ...base, motivo: 'vazio' };

  const printStart = /^PRINT_START\b.*$/m.exec(texto)?.[0] ?? '';
  if (!printStart) return { ...base, motivo: 'sem_print_start' };

  // O PRINT_END aparece também como valor de `machine_end_gcode` no bloco de
  // configuração; só conta o comando, no início de uma linha.
  if (!/^PRINT_END\b/m.test(texto)) {
    return { ...base, motivo: 'sem_print_end' };
  }

  const camadas =
    numero(/^;\s*total layer number:\s*(\d+)/m, texto) ??
    texto.match(/^;LAYER_CHANGE\b/gm)?.length ??
    0;
  if (camadas <= 0) return { ...base, motivo: 'sem_camadas' };

  if (!MARCA_FIM.test(ultimaLinha(texto))) {
    return { ...base, motivo: 'sem_fim' };
  }

  return {
    valido: true,
    bytes,
    camadas,
    bico: numero(/EXTRUDER=(\d+(?:\.\d+)?)/, printStart),
    mesa: numero(/BED=(\d+(?:\.\d+)?)/, printStart),
    filamento: /^;\s*filament_type\s*=\s*(.+)$/m.exec(texto)?.[1].trim() ?? '',
    perfilFilamento: (
      /^;\s*filament_settings_id\s*=\s*(.+)$/m.exec(texto)?.[1] ?? ''
    )
      .trim()
      .replace(/^"|"$/g, ''),
    tempo:
      /^;\s*estimated printing time \(normal mode\)\s*=\s*(.+)$/m.exec(
        texto
      )?.[1] ?? '',
    gramas: numero(/^;\s*total filament used \[g\]\s*=\s*([\d.]+)/m, texto),
  };
};
