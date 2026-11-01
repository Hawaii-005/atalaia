import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { hexDe } from '../../../theme/temas';
import { t } from '../../../i18n';
import { Cartao, Linha, LinhaSwitch, Vazio } from '../componentes';
import { PropsSecao } from '../tipos';

const IDS = [
  'fila.auto',
  'fila.pausa',
  'fila.mesaLimpa',
  'fila.notifConcluida',
  'fila.notifPausada',
  'fila.notifMarcos',
  'fila.notifDesligada',
  'fila.modoRemoto',
  'fila.testeNotif',
];

export const SecaoFila = ({ ctx, visivel }: PropsSecao) => {
  const { tema } = useTheme();
  if (!IDS.some(visivel)) return <Vazio texto={t('settings.semResultados')} />;
  const ultimo = (id: string) => {
    const seguintes = IDS.slice(IDS.indexOf(id) + 1);
    return !seguintes.some(visivel);
  };

  return (
    <Cartao
      titulo={t('settings.seccaoFila')}
      icone="list-outline"
      cor={hexDe(tema.paleta.aviso)}
    >
      {visivel('fila.auto') && (
        <LinhaSwitch
          icone="play-forward-outline"
          rotulo={t('settings.filaAuto')}
          ajuda={
            ctx.filaTamanho > 0
              ? t('settings.filaAutoDescN', { n: ctx.filaTamanho })
              : t('settings.filaAutoDesc')
          }
          valor={ctx.filaAuto}
          aoMudar={ctx.definirFilaAuto}
          ultimo={ultimo('fila.auto')}
        />
      )}

      {visivel('fila.pausa') && (
        <Linha
          icone="hourglass-outline"
          rotulo={t('settings.pausaFila')}
          ajuda={t('settings.pausaFilaDesc')}
          valor={t('settings.pausaFilaValor')}
          ultimo={ultimo('fila.pausa')}
        />
      )}

      {visivel('fila.mesaLimpa') && (
        <Linha
          icone="shield-checkmark-outline"
          rotulo={t('settings.mesaLimpa')}
          ajuda={t('settings.mesaLimpaDesc')}
          ultimo={ultimo('fila.mesaLimpa')}
        />
      )}

      {visivel('fila.notifConcluida') && (
        <LinhaSwitch
          icone="checkmark-circle-outline"
          rotulo={t('settings.notifConcluida')}
          ajuda={t('settings.notifConcluidaDesc')}
          valor={ctx.notificacoes.finished}
          aoMudar={v => ctx.definirNotificacao('finished', v)}
          ultimo={ultimo('fila.notifConcluida')}
        />
      )}
      {visivel('fila.notifPausada') && (
        <LinhaSwitch
          icone="pause-circle-outline"
          rotulo={t('settings.notifPausada')}
          ajuda={t('settings.notifPausadaDesc')}
          valor={ctx.notificacoes.paused}
          aoMudar={v => ctx.definirNotificacao('paused', v)}
          ultimo={ultimo('fila.notifPausada')}
        />
      )}
      {visivel('fila.notifMarcos') && (
        <LinhaSwitch
          icone="trending-up-outline"
          rotulo={t('settings.notifMarcos')}
          ajuda={t('settings.notifMarcosDesc')}
          valor={ctx.notificacoes.milestones}
          aoMudar={v => ctx.definirNotificacao('milestones', v)}
          ultimo={ultimo('fila.notifMarcos')}
        />
      )}
      {visivel('fila.notifDesligada') && (
        <LinhaSwitch
          icone="cloud-offline-outline"
          rotulo={t('settings.notifDesligada')}
          ajuda={t('settings.notifDesligadaDesc')}
          valor={ctx.notificacoes.offline}
          aoMudar={v => ctx.definirNotificacao('offline', v)}
          ultimo={ultimo('fila.notifDesligada')}
        />
      )}

      {visivel('fila.modoRemoto') && (
        <LinhaSwitch
          icone="cellular-outline"
          rotulo={t('settings.modoRemoto')}
          ajuda={t('settings.modoRemotoDesc')}
          valor={ctx.modoRemoto}
          aoMudar={ctx.definirModoRemoto}
          ultimo={ultimo('fila.modoRemoto')}
        />
      )}

      {visivel('fila.testeNotif') && (
        <Linha
          icone="notifications-outline"
          rotulo={t('settings.notificacaoTeste')}
          ajuda={t('settings.ajudaTesteNotificacao')}
          aoTocar={ctx.testarNotificacao}
          ultimo
        />
      )}
    </Cartao>
  );
};
