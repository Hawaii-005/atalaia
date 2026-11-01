import { log } from './log';
import {
  carregarEstado,
  EstadoFilamentos,
  guardarEstado,
} from './filamentos/armazenamento';
import {
  ConsumoPendente,
  Garrafa,
  Rolo,
  Spool,
  UsageRecord,
} from './filamentos/modelo';
import {
  apagarBobina,
  aplicarConsumoTrabalho,
  associarSlot,
  ConsumoItem,
  criarBobina,
  custoDeConsumo,
  desassociarSlot,
  descontarConsumo,
  editarBobina,
  idNovo,
  jaRegistado,
  roloActivo,
} from './filamentos/operacoes';
import { filamentosDoCabecalho } from './gcodeCores';

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

export type { Rolo, Garrafa, ConsumoPendente, ConsumoItem };

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

export { roloActivo };

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

/** Edita os dados locais de uma bobina (nome, marca, preço, peso, notas…). */
export const actualizarRolo = async (
  id: string,
  alteracoes: Partial<Omit<Rolo, 'id' | 'criadoEm' | 'canvasSlot'>> & {
    canvasSlot?: number | null;
  }
): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: estado.bobinas.map(rolo =>
      rolo.id === id ? editarBobina(rolo, alteracoes) : rolo
    ),
  }));
};

/** Liga a bobina a um slot do Canvas (só localmente — nada é enviado). */
export const associarRolo = async (
  id: string,
  printerId: string,
  slot: number
): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: associarSlot(estado.bobinas, id, printerId, slot),
  }));
};

export const desassociarRolo = async (id: string): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: desassociarSlot(estado.bobinas, id),
  }));
};

export const arquivarRolo = async (
  id: string,
  arquivada = true
): Promise<void> => {
  await mutar(estado => ({
    ...estado,
    bobinas: estado.bobinas.map(rolo =>
      rolo.id === id
        ? {
            ...rolo,
            arquivada,
            canvasSlot: arquivada ? undefined : rolo.canvasSlot,
          }
        : rolo
    ),
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
 * Lê os consumos de filamento por ferramenta/slot ou total que o slicer
 * deixou no cabeçalho do G-code.
 */
export const lerConsumoDoGcode = async (
  host: string,
  nome: string,
  timeoutMs = 9000
): Promise<ConsumoItem[] | null> => {
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

    // 1. Tentar ler consumos detalhados por ferramenta
    const filamentos = filamentosDoCabecalho(texto);
    if (filamentos.length > 0) {
      return filamentos.map(f => ({
        slot: f.tool,
        gramas: f.gramas,
      }));
    }

    // 2. Fallbacks de peso total do ficheiro (sem slot atribuído)
    const gramas = texto.match(/total filament used \[g\]\s*=\s*([\d.]+)/i);
    if (gramas) return [{ gramas: Number(gramas[1]) }];

    const gramas2 = texto.match(/filament used \[g\]\s*=\s*([\d.]+)/i);
    if (gramas2) return [{ gramas: Number(gramas2[1]) }];

    const peso = texto.match(/filament weight[:=]\s*([\d.]+)/i);
    if (peso) return [{ gramas: Number(peso[1]) }];

    const metros = texto.match(/filament used[:=]\s*([\d.]+)\s*m\b/i);
    if (metros) {
      // 1,75 mm de diâmetro e 1,24 g/cm³ → 2,98 g por metro.
      return [{ gramas: Math.round(Number(metros[1]) * 2.98 * 10) / 10 }];
    }
    return null;
  } catch (erro) {
    log('consumo do gcode indisponível', erro);
    return null;
  } finally {
    clearTimeout(alarme);
  }
};

/**
 * Lê o peso total de filamento que o slicer deixou no cabeçalho do G-code.
 * Cura escreve metros (`;Filament used: 12.3m`), Orca/Prusa escrevem gramas.
 * Devolve null quando o ficheiro não traz nada — não há estimativa inventada.
 */
export const lerPesoDoGcode = async (
  host: string,
  nome: string,
  timeoutMs = 9000
): Promise<number | null> => {
  const consumos = await lerConsumoDoGcode(host, nome, timeoutMs);
  if (!consumos || consumos.length === 0) return null;
  const total = consumos.reduce((soma, item) => soma + item.gramas, 0);
  return Math.round(total * 10) / 10;
};

/**
 * Desconta o trabalho acabado das bobinas correspondentes aos slots ou rolo
 * activo. Idempotente quando recebe taskId (não desconta duas vezes o mesmo trabalho).
 * Sem gramas conhecidas ou sem bobina correspondente, regista um pendente.
 */
export const registarConsumo = async (
  printerId: string,
  host: string,
  filename: string,
  gramasConhecidas?: number | ConsumoItem[] | null,
  taskId?: string
): Promise<void> => {
  let consumos: ConsumoItem[] | null = null;

  if (typeof gramasConhecidas === 'number') {
    consumos = [{ gramas: gramasConhecidas }];
  } else if (Array.isArray(gramasConhecidas)) {
    consumos = gramasConhecidas;
  } else {
    consumos = await lerConsumoDoGcode(host, filename);
  }

  const agora = Date.now();
  const effectiveJobId = taskId || `local-${filename}-${agora}`;

  await mutar(estado => {
    // Idempotência: não repetir se este taskId já foi registado nos usos
    if (taskId && jaRegistado(estado.usos, taskId)) {
      log(`Consumo já registado para o trabalho ${taskId}, a ignorar.`);
      return estado;
    }

    if (!consumos || consumos.length === 0) {
      return {
        ...estado,
        pendentes: [
          ...estado.pendentes,
          {
            id: idNovo(),
            printerId,
            filename,
            quando: agora,
            gramas: null,
          },
        ],
      };
    }

    const { bobinas, novosUsos } = aplicarConsumoTrabalho(
      estado.bobinas,
      printerId,
      consumos,
      effectiveJobId,
      agora
    );

    if (novosUsos.length === 0) {
      const somaGramas = consumos.reduce((acc, c) => acc + c.gramas, 0);
      return {
        ...estado,
        pendentes: [
          ...estado.pendentes,
          {
            id: idNovo(),
            printerId,
            filename,
            quando: agora,
            gramas: somaGramas > 0 ? somaGramas : null,
          },
        ],
      };
    }

    return {
      ...estado,
      bobinas,
      usos: [...estado.usos, ...novosUsos],
    };
  });
};

/** Desconta o consumo por slot para impressões FDM multi-material. */
export const registarConsumoPorSlot = async (
  printerId: string,
  consumos: Record<number, number>,
  taskId?: string
): Promise<void> => {
  const listaConsumos: ConsumoItem[] = Object.entries(consumos).map(
    ([slotStr, gramas]) => ({
      slot: Number(slotStr),
      gramas,
    })
  );
  await registarConsumo(printerId, '', '', listaConsumos, taskId);
};

/** Fecha um consumo pendente com os gramas que o utilizador indicar. */
export const confirmarConsumo = async (
  pendenteId: string,
  gramas: number,
  slot?: number
): Promise<void> => {
  await mutar(estado => {
    const pendente = estado.pendentes.find(p => p.id === pendenteId);
    if (!pendente) return estado;

    let alvo: Spool | null = null;
    if (slot !== undefined) {
      alvo =
        estado.bobinas.find(
          b =>
            b.printerId === pendente.printerId &&
            !b.arquivada &&
            b.canvasSlot === slot
        ) ?? null;
    }
    if (!alvo) {
      alvo = roloActivo(estado.bobinas, pendente.printerId);
    }

    if (!alvo) {
      return {
        ...estado,
        pendentes: estado.pendentes.filter(p => p.id !== pendenteId),
      };
    }

    const agora = Date.now();
    const bobinaActualizada = descontarConsumo(alvo, gramas);
    const novoUso: UsageRecord = {
      id: idNovo(),
      jobId: `pendente-${pendenteId}`,
      printerId: pendente.printerId,
      spoolId: alvo.id,
      gramas,
      custo: custoDeConsumo(alvo, gramas),
      quando: agora,
    };

    return {
      ...estado,
      bobinas: estado.bobinas.map(item =>
        item.id === alvo!.id ? bobinaActualizada : item
      ),
      usos: [...estado.usos, novoUso],
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
