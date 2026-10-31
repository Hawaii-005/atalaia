import { log } from './log';
import {
  carregarEstado,
  EstadoFilamentos,
  guardarEstado,
} from './filamentos/armazenamento';
import { ConsumoPendente, Garrafa, Rolo } from './filamentos/modelo';
import {
  apagarBobina,
  criarBobina,
  descontarConsumo,
  editarBobina,
  idNovo,
} from './filamentos/operacoes';

/**
 * Inventário de consumíveis — fachada antiga sobre o armazenamento novo.
 *
 * A impressora não devolve gramas (nem ml): o saldo é sempre uma conta local.
 * O peso que sobra é descontado com o que o slicer escreve no cabeçalho do
 * G-code; quando o ficheiro não traz esse valor, o consumo fica «por confirmar»
 * e é o utilizador que o fecha — nunca se inventa um número.
 *
 * O modelo com slots do CANVAS vive em `./filamentos/modelo`; este módulo
 * mantém a API que os ecrãs já usam (`Rolo` é o nome antigo de `Spool`).
 */

export type { Rolo, Garrafa, ConsumoPendente };

export type Inventario = {
  rolos: Rolo[];
  garrafas: Garrafa[];
  pendentes: ConsumoPendente[];
};

const paraInventario = (estado: EstadoFilamentos): Inventario => ({
  rolos: estado.bobinas,
  garrafas: estado.garrafas,
  pendentes: estado.pendentes,
});

export const carregarInventario = async (): Promise<Inventario> =>
  paraInventario(await carregarEstado());

/** Rolo mais recente dessa impressora — é o que está carregado. */
export const roloActivo = (rolos: Rolo[], printerId: string) =>
  rolos
    .filter(r => r.printerId === printerId && !r.arquivada)
    .sort((a, b) => b.criadoEm - a.criadoEm)[0];

export const garrafaActiva = (garrafas: Garrafa[], printerId: string) =>
  garrafas
    .filter(g => g.printerId === printerId)
    .sort((a, b) => b.criadoEm - a.criadoEm)[0];

export const custoPorGrama = (rolo: Rolo) =>
  rolo.pesoInicial > 0 ? rolo.preco / rolo.pesoInicial : 0;

export const valorRestante = (rolo: Rolo) =>
  custoPorGrama(rolo) * rolo.restante;

export const custoPorMl = (garrafa: Garrafa) =>
  garrafa.volumeInicial > 0 ? garrafa.preco / garrafa.volumeInicial : 0;

const mutar = async (
  alterar: (estado: EstadoFilamentos) => EstadoFilamentos
): Promise<EstadoFilamentos> => {
  const estado = await carregarEstado();
  const novo = alterar(estado);
  await guardarEstado(novo);
  return novo;
};

export const adicionarRolo = async (
  dados: Omit<Rolo, 'id' | 'criadoEm' | 'restante' | 'marca'> & {
    marca?: string;
    restante?: number;
  }
): Promise<Rolo> => {
  const rolo = criarBobina(dados);
  await mutar(estado => ({ ...estado, bobinas: [...estado.bobinas, rolo] }));
  return rolo;
};

/** «Novo filamento»: repõe o mesmo rolo com o peso e o preço de agora. */
export const reporRolo = async (
  id: string,
  valores: { pesoInicial: number; preco: number }
): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: estado.bobinas.map(rolo =>
      rolo.id === id
        ? {
            ...editarBobina(rolo, {
              ...valores,
              restante: valores.pesoInicial,
            }),
            criadoEm: Date.now(),
          }
        : rolo
    ),
  }));
};

export const ajustarRestante = async (
  id: string,
  gramas: number
): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: estado.bobinas.map(rolo =>
      rolo.id === id ? editarBobina(rolo, { restante: gramas }) : rolo
    ),
  }));
};

export const removerRolo = async (id: string): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: apagarBobina(estado.bobinas, id),
  }));
};

export const adicionarGarrafa = async (
  dados: Omit<Garrafa, 'id' | 'criadoEm' | 'restante'> & { restante?: number }
): Promise<Garrafa> => {
  const garrafa: Garrafa = {
    ...dados,
    restante: dados.restante ?? dados.volumeInicial,
    id: idNovo(),
    criadoEm: Date.now(),
  };
  await mutar(estado => ({
    ...estado,
    garrafas: [...estado.garrafas, garrafa],
  }));
  return garrafa;
};

export const ajustarRestanteMl = async (
  id: string,
  ml: number
): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    garrafas: estado.garrafas.map(garrafa =>
      garrafa.id === id
        ? {
            ...garrafa,
            restante: Math.max(0, Math.min(garrafa.volumeInicial, ml)),
          }
        : garrafa
    ),
  }));
};

/**
 * Lê o peso de filamento que o slicer deixou no cabeçalho do G-code.
 * Cura escreve metros (`;Filament used: 12.3m`), Orca/Prusa escrevem gramas.
 * Devolve null quando o ficheiro não traz nada — não há estimativa inventada.
 */
export const lerPesoDoGcode = async (
  host: string,
  nome: string,
  timeoutMs = 9000
): Promise<number | null> => {
  const controlador = new AbortController();
  const alarme = setTimeout(() => controlador.abort(), timeoutMs);
  try {
    const limpo = nome.replace(/^\/?(local\/)?\/?/, '');
    const resposta = await fetch(
      `http://${host}/local/${encodeURIComponent(limpo)}`,
      { signal: controlador.signal }
    );
    if (!resposta.ok) return null;
    const texto = (await resposta.text()).slice(0, 400000);

    const gramas = texto.match(/total filament used \[g\]\s*=\s*([\d.]+)/i);
    if (gramas) return Number(gramas[1]);

    const gramas2 = texto.match(/filament used \[g\]\s*=\s*([\d.]+)/i);
    if (gramas2) return Number(gramas2[1]);

    const peso = texto.match(/filament weight[:=]\s*([\d.]+)/i);
    if (peso) return Number(peso[1]);

    const metros = texto.match(/filament used[:=]\s*([\d.]+)\s*m\b/i);
    if (metros) {
      // 1,75 mm de diâmetro e 1,24 g/cm³ → 2,98 g por metro.
      return Math.round(Number(metros[1]) * 2.98 * 10) / 10;
    }
    return null;
  } catch (erro) {
    log('peso do gcode indisponível', erro);
    return null;
  } finally {
    clearTimeout(alarme);
  }
};

/**
 * Desconta o trabalho acabado do rolo carregado. Sem gramas conhecidas fica
 * um pendente para o utilizador fechar à mão.
 */
export const registarConsumo = async (
  printerId: string,
  host: string,
  filename: string,
  gramasConhecidas?: number | null
): Promise<void> => {
  const gramas = gramasConhecidas ?? (await lerPesoDoGcode(host, filename));

  await mutar(estado => {
    if (gramas == null) {
      return {
        ...estado,
        pendentes: [
          ...estado.pendentes,
          {
            id: idNovo(),
            printerId,
            filename,
            quando: Date.now(),
            gramas: null,
          },
        ],
      };
    }

    const rolo = roloActivo(estado.bobinas, printerId);
    if (!rolo) return estado;

    return {
      ...estado,
      bobinas: estado.bobinas.map(item =>
        item.id === rolo.id ? descontarConsumo(item, gramas) : item
      ),
    };
  });
};

/** Fecha um consumo pendente com os gramas que o utilizador indicar. */
export const confirmarConsumo = async (
  pendenteId: string,
  gramas: number
): Promise<void> => {
  await mutar(estado => {
    const pendente = estado.pendentes.find(p => p.id === pendenteId);
    if (!pendente) return estado;
    const rolo = roloActivo(estado.bobinas, pendente.printerId);
    return {
      ...estado,
      bobinas: rolo
        ? estado.bobinas.map(item =>
            item.id === rolo.id ? descontarConsumo(item, gramas) : item
          )
        : estado.bobinas,
      pendentes: estado.pendentes.filter(p => p.id !== pendenteId),
    };
  });
};

export const descartarConsumo = async (pendenteId: string): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    pendentes: estado.pendentes.filter(p => p.id !== pendenteId),
  }));
};
