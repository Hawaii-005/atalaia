import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from './log';

/**
 * Inventário de consumíveis.
 *
 * A impressora não devolve gramas (nem ml): o saldo é sempre uma conta local.
 * O peso que sobra é descontado com o que o slicer escreve no cabeçalho do
 * G-code; quando o ficheiro não traz esse valor, o consumo fica «por confirmar»
 * e é o utilizador que o fecha — nunca se inventa um número.
 */

export type Rolo = {
  id: string;
  printerId: string;
  nome: string;
  material: string;
  cor: string;
  pesoInicial: number;
  preco: number;
  restante: number;
  criadoEm: number;
};

export type Garrafa = {
  id: string;
  printerId: string;
  nome: string;
  cor: string;
  volumeInicial: number;
  preco: number;
  restante: number;
  criadoEm: number;
};

export type ConsumoPendente = {
  id: string;
  printerId: string;
  filename: string;
  quando: number;
  gramas: number | null;
};

export type Inventario = {
  rolos: Rolo[];
  garrafas: Garrafa[];
  pendentes: ConsumoPendente[];
};

const CHAVE = 'atalaia.inventario.v1';
const VAZIO: Inventario = { rolos: [], garrafas: [], pendentes: [] };

const novoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const carregarInventario = async (): Promise<Inventario> => {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    if (!bruto) return { ...VAZIO };
    const dados = JSON.parse(bruto) as Partial<Inventario>;
    return {
      rolos: Array.isArray(dados.rolos) ? dados.rolos : [],
      garrafas: Array.isArray(dados.garrafas) ? dados.garrafas : [],
      pendentes: Array.isArray(dados.pendentes) ? dados.pendentes : [],
    };
  } catch (erro) {
    log('inventário ilegível', erro);
    return { ...VAZIO };
  }
};

const guardar = (dados: Inventario) => AsyncStorage.setItem(CHAVE, JSON.stringify(dados));

/** Rolo mais recente dessa impressora — é o que está carregado. */
export const roloActivo = (rolos: Rolo[], printerId: string) =>
  rolos
    .filter(r => r.printerId === printerId)
    .sort((a, b) => b.criadoEm - a.criadoEm)[0];

export const garrafaActiva = (garrafas: Garrafa[], printerId: string) =>
  garrafas
    .filter(g => g.printerId === printerId)
    .sort((a, b) => b.criadoEm - a.criadoEm)[0];

export const custoPorGrama = (rolo: Rolo) =>
  rolo.pesoInicial > 0 ? rolo.preco / rolo.pesoInicial : 0;

export const valorRestante = (rolo: Rolo) => custoPorGrama(rolo) * rolo.restante;

export const custoPorMl = (garrafa: Garrafa) =>
  garrafa.volumeInicial > 0 ? garrafa.preco / garrafa.volumeInicial : 0;

export const adicionarRolo = async (
  dados: Omit<Rolo, 'id' | 'criadoEm' | 'restante'> & { restante?: number }
): Promise<Rolo> => {
  const inventario = await carregarInventario();
  const rolo: Rolo = {
    ...dados,
    restante: dados.restante ?? dados.pesoInicial,
    id: novoId(),
    criadoEm: Date.now(),
  };
  await guardar({ ...inventario, rolos: [...inventario.rolos, rolo] });
  return rolo;
};

/** «Novo filamento»: repõe o mesmo rolo com o peso e o preço de agora. */
export const reporRolo = async (
  id: string,
  valores: { pesoInicial: number; preco: number }
): Promise<void> => {
  const inventario = await carregarInventario();
  await guardar({
    ...inventario,
    rolos: inventario.rolos.map(r =>
      r.id === id ? { ...r, ...valores, restante: valores.pesoInicial, criadoEm: Date.now() } : r
    ),
  });
};

export const ajustarRestante = async (id: string, gramas: number): Promise<void> => {
  const inventario = await carregarInventario();
  await guardar({
    ...inventario,
    rolos: inventario.rolos.map(r =>
      r.id === id ? { ...r, restante: Math.max(0, Math.min(r.pesoInicial, gramas)) } : r
    ),
  });
};

export const removerRolo = async (id: string): Promise<void> => {
  const inventario = await carregarInventario();
  await guardar({ ...inventario, rolos: inventario.rolos.filter(r => r.id !== id) });
};

export const adicionarGarrafa = async (
  dados: Omit<Garrafa, 'id' | 'criadoEm' | 'restante'> & { restante?: number }
): Promise<Garrafa> => {
  const inventario = await carregarInventario();
  const garrafa: Garrafa = {
    ...dados,
    restante: dados.restante ?? dados.volumeInicial,
    id: novoId(),
    criadoEm: Date.now(),
  };
  await guardar({ ...inventario, garrafas: [...inventario.garrafas, garrafa] });
  return garrafa;
};

export const ajustarRestanteMl = async (id: string, ml: number): Promise<void> => {
  const inventario = await carregarInventario();
  await guardar({
    ...inventario,
    garrafas: inventario.garrafas.map(g =>
      g.id === id ? { ...g, restante: Math.max(0, Math.min(g.volumeInicial, ml)) } : g
    ),
  });
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
  const inventario = await carregarInventario();
  const gramas = gramasConhecidas ?? (await lerPesoDoGcode(host, filename));

  if (gramas == null) {
    await guardar({
      ...inventario,
      pendentes: [
        ...inventario.pendentes,
        { id: novoId(), printerId, filename, quando: Date.now(), gramas: null },
      ],
    });
    return;
  }

  const rolo = roloActivo(inventario.rolos, printerId);
  if (!rolo) return;

  await guardar({
    ...inventario,
    rolos: inventario.rolos.map(r =>
      r.id === rolo.id ? { ...r, restante: Math.max(0, Math.round((r.restante - gramas) * 10) / 10) } : r
    ),
  });
};

/** Fecha um consumo pendente com os gramas que o utilizador indicar. */
export const confirmarConsumo = async (pendenteId: string, gramas: number): Promise<void> => {
  const inventario = await carregarInventario();
  const pendente = inventario.pendentes.find(p => p.id === pendenteId);
  if (!pendente) return;
  const rolo = roloActivo(inventario.rolos, pendente.printerId);
  await guardar({
    rolos: inventario.rolos.map(r =>
      rolo && r.id === rolo.id
        ? { ...r, restante: Math.max(0, Math.round((r.restante - gramas) * 10) / 10) }
        : r
    ),
    garrafas: inventario.garrafas,
    pendentes: inventario.pendentes.filter(p => p.id !== pendenteId),
  });
};

export const descartarConsumo = async (pendenteId: string): Promise<void> => {
  const inventario = await carregarInventario();
  await guardar({
    ...inventario,
    pendentes: inventario.pendentes.filter(p => p.id !== pendenteId),
  });
};
