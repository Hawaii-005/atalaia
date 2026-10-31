import { useEffect, useRef } from 'react';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { getPrintStatus } from '../types';
import { registarConsumo } from '../utils/inventario';

/**
 * Quando um trabalho passa de «a imprimir» a «terminada», desconta o peso que
 * o G-code declara do rolo carregado. Sem peso no ficheiro, fica pendente.
 */
export const useConsumoFilamento = () => {
  const { printers } = usePrinterConnections();
  const anteriores = useRef<Record<string, { fase: string; nome?: string }>>(
    {}
  );

  useEffect(() => {
    printers.forEach(pr => {
      if ((pr.kind ?? 'fdm') === 'resin') return;
      const info = pr.status?.PrintInfo;
      const fase = getPrintStatus(info?.Status ?? 0);
      const nome = info?.Filename;
      const antes = anteriores.current[pr.id];

      if (
        antes?.nome &&
        nome === antes.nome &&
        antes.fase === 'printing' &&
        fase === 'completed'
      ) {
        registarConsumo(pr.id, pr.ipAddress, nome).catch(() => undefined);
      }

      anteriores.current[pr.id] = { fase, nome };
    });
  }, [printers]);
};
