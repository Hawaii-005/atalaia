import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrinterConnections } from './PrinterConnectionsContext';
import { Printer } from '../types';

/**
 * Máquina seleccionada na aba Impressora.
 *
 * Vive num contexto (e não em parâmetros de rota) para que trocar de máquina não
 * empilhe ecrãs, e para que a secção aberta sobreviva à troca. Se a secção não
 * existir na máquina de destino, cai em `estado`.
 */

export type Secao = 'estado' | 'ficheiros' | 'filamentos' | 'controlos';

const CHAVE = 'atalaia.maquina';

export const secoesDaMaquina = (printer: Printer | undefined): Secao[] => {
  if (!printer) return ['estado'];
  if ((printer.kind ?? 'fdm') === 'resin') return ['estado'];
  return ['estado', 'ficheiros', 'filamentos', 'controlos'];
};

interface Contexto {
  maquinaId: string | null;
  maquina: Printer | undefined;
  secao: Secao;
  mudarMaquina: (id: string) => void;
  mudarSecao: (s: Secao) => void;
}

const SelectedPrinterContext = createContext<Contexto | undefined>(undefined);

export const SelectedPrinterProvider = ({ children }: { children: React.ReactNode }) => {
  const { printers } = usePrinterConnections();
  const [maquinaId, setMaquinaId] = useState<string | null>(null);
  const [secao, setSecao] = useState<Secao>('estado');

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then(guardado => {
        if (guardado) setMaquinaId(guardado);
      })
      .catch(() => undefined);
  }, []);

  // Sem escolha (ou escolha inválida), a primeira máquina.
  useEffect(() => {
    if (printers.length === 0) return;
    if (!maquinaId || !printers.some(p => p.id === maquinaId)) {
      setMaquinaId(printers[0].id);
    }
  }, [printers, maquinaId]);

  const maquina = useMemo(
    () => printers.find(p => p.id === maquinaId),
    [printers, maquinaId]
  );

  const mudarMaquina = useCallback(
    (id: string) => {
      setMaquinaId(id);
      AsyncStorage.setItem(CHAVE, id).catch(() => undefined);
      const destino = printers.find(p => p.id === id);
      const permitidas = secoesDaMaquina(destino);
      setSecao(actual => (permitidas.includes(actual) ? actual : 'estado'));
    },
    [printers]
  );

  const mudarSecao = useCallback((s: Secao) => setSecao(s), []);

  const valor = useMemo(
    () => ({ maquinaId, maquina, secao, mudarMaquina, mudarSecao }),
    [maquinaId, maquina, secao, mudarMaquina, mudarSecao]
  );

  return (
    <SelectedPrinterContext.Provider value={valor}>{children}</SelectedPrinterContext.Provider>
  );
};

export const useSelectedPrinter = (): Contexto => {
  const ctx = useContext(SelectedPrinterContext);
  if (!ctx) throw new Error('useSelectedPrinter fora do SelectedPrinterProvider');
  return ctx;
};

/** Abre a aba Impressora na máquina indicada (e na secção, se existir). */
export const useAbrirMaquina = (navigation: any) => {
  const { mudarMaquina, mudarSecao } = useSelectedPrinter();
  return useCallback(
    (id: string, destino?: Secao) => {
      mudarMaquina(id);
      if (destino) mudarSecao(destino);
      navigation.navigate('Impressora');
    },
    [mudarMaquina, mudarSecao, navigation]
  );
};
