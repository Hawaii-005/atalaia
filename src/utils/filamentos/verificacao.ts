import { Spool } from './modelo';

export interface FerramentaGcode {
  index: number;
  material?: string;
  cor?: string;
  pesoG?: number;
}

export type TipoAvisoSlot =
  | 'SEM_BOBINA'
  | 'MATERIAL_DIFERENTE'
  | 'PESO_INSUFICIENTE';

export interface AvisoVerificacaoSlot {
  slot: number;
  tipo: TipoAvisoSlot;
  mensagem: string;
}

export const verificarCompatibilidadeSlot = (
  slot: number,
  ferramenta: FerramentaGcode,
  bobinaLocal?: Spool
): AvisoVerificacaoSlot[] => {
  const avisos: AvisoVerificacaoSlot[] = [];
  const rotuloSlot = `A${slot + 1}`;

  if (!bobinaLocal) {
    avisos.push({
      slot,
      tipo: 'SEM_BOBINA',
      mensagem: `Slot ${rotuloSlot} não tem bobina associada no inventário.`,
    });
    return avisos;
  }

  if (
    ferramenta.material &&
    bobinaLocal.material &&
    ferramenta.material.trim().toUpperCase() !==
      bobinaLocal.material.trim().toUpperCase()
  ) {
    avisos.push({
      slot,
      tipo: 'MATERIAL_DIFERENTE',
      mensagem: `Slot ${rotuloSlot} tem ${bobinaLocal.material.toUpperCase()}, mas o G-code requer ${ferramenta.material.toUpperCase()}.`,
    });
  }

  if (
    ferramenta.pesoG !== undefined &&
    ferramenta.pesoG > 0 &&
    bobinaLocal.restante < ferramenta.pesoG
  ) {
    avisos.push({
      slot,
      tipo: 'PESO_INSUFICIENTE',
      mensagem: `Slot ${rotuloSlot} tem ${Math.round(bobinaLocal.restante)} g restantes, mas o G-code requer ${Math.round(ferramenta.pesoG)} g.`,
    });
  }

  return avisos;
};

export const verificarTodosOsSlots = (
  ferramentas: FerramentaGcode[],
  bobinasLocais: Spool[]
): AvisoVerificacaoSlot[] => {
  const avisos: AvisoVerificacaoSlot[] = [];
  for (const f of ferramentas) {
    const slot = f.index;
    const bobina = bobinasLocais.find(
      b => b.canvasSlot === slot && !b.arquivada
    );
    avisos.push(...verificarCompatibilidadeSlot(slot, f, bobina));
  }
  return avisos;
};
