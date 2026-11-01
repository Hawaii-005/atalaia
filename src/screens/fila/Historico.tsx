import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t, useIdioma } from '../../i18n';
import { formatDuracao } from '../../utils/duracao';
import { PrintRecord, loadHistory } from '../../utils/printHistory';

type Props = { impressora: string };

const ROTULO_RESULTADO: Record<PrintRecord['outcome'], string> = {
  completed: 'fila.resultado.completed',
  stopped: 'fila.resultado.stopped',
  printing: 'fila.resultado.printing',
  unknown: 'fila.resultado.unknown',
};

/** Últimas impressões desta máquina, com duração real. */
export const Historico = ({ impressora }: Props) => {
  useIdioma();
  const { tema } = useTheme();
  const p = tema.paleta;
  const [registos, setRegistos] = useState<PrintRecord[]>([]);

  useEffect(() => {
    let vivo = true;
    loadHistory()
      .then(lista => {
        if (vivo) setRegistos(lista);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [impressora]);

  const daMaquina = registos
    .filter(registo => registo.printerName === impressora)
    .slice(0, 3);

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{ fontSize: 12, fontWeight: '700', color: hexDe(p.tintaSoft) }}
      >
        {t('fila.historicoTitulo')}
      </Text>
      {daMaquina.length === 0 ? (
        <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft) }}>
          {t('fila.historicoVazio')}
        </Text>
      ) : (
        daMaquina.map(registo => {
          const duracao =
            registo.endedAt && registo.startedAt
              ? formatDuracao(
                  Math.max(
                    0,
                    Math.round((registo.endedAt - registo.startedAt) / 1000)
                  )
                )
              : '';
          const fim = registo.endedAt
            ? new Date(registo.endedAt).toLocaleString(undefined, {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—';
          return (
            <View
              key={registo.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: hexDe(p.linha) + '55',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: hexDe(p.tinta),
                  }}
                >
                  {registo.filename}
                </Text>
                <Text style={{ fontSize: 11, color: hexDe(p.tintaSoft) }}>
                  {t(ROTULO_RESULTADO[registo.outcome])} · {fim}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: hexDe(p.tintaSoft) }}>
                {duracao || '—'}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
};
