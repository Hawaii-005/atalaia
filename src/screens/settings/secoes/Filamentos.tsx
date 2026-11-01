import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { hexDe } from '../../../theme/temas';
import { t } from '../../../i18n';
import { Cartao, Linha, LinhaNumero, Vazio } from '../componentes';
import { PropsSecao } from '../tipos';

export const SecaoFilamentos = ({ ctx, visivel }: PropsSecao) => {
  const { tema } = useTheme();
  const nada =
    !visivel('filamentos.limite') &&
    visivel('filamentos.kwh') &&
    visivel('filamentos.potencia') &&
    !visivel('filamentos.inventario');
  if (nada) return <Vazio texto={t('settings.semResultados')} />;

  return (
    <Cartao
      titulo={t('settings.seccaoFilamentos')}
      icone="layers-outline"
      cor={hexDe(tema.paleta.ok)}
    >
      {visivel('filamentos.limite') && (
        <LinhaNumero
          icone="alert-circle-outline"
          rotulo={t('settings.limiteTitulo')}
          ajuda={t('settings.limiteDesc')}
          valor={ctx.limite}
          unidade="%"
          teclado="number-pad"
          aoGuardar={ctx.guardarLimite}
          ultimo={
            visivel('filamentos.kwh') &&
            visivel('filamentos.potencia') &&
            !visivel('filamentos.inventario')
          }
        />
      )}

      {visivel('filamentos.kwh') && (
        <LinhaNumero
          icone="flash-outline"
          rotulo={t('settings.kwhTitulo')}
          ajuda={t('settings.kwhDesc')}
          valor={ctx.precoKwh}
          unidade="€/kWh"
          aoGuardar={ctx.guardarPrecoKwh}
          ultimo={
            visivel('filamentos.potencia') && !visivel('filamentos.inventario')
          }
        />
      )}

      {visivel('filamentos.potencia') && (
        <LinhaNumero
          icone="speedometer-outline"
          rotulo={t('settings.potenciaTitulo')}
          ajuda={t('settings.potenciaDesc')}
          valor={ctx.potenciaW}
          unidade="W"
          teclado="number-pad"
          aoGuardar={ctx.guardarPotenciaW}
          ultimo={!visivel('filamentos.inventario')}
        />
      )}

      {visivel('filamentos.inventario') && (
        <Linha
          icone="cube-outline"
          rotulo={t('settings.consumiveis')}
          ajuda={t('settings.consumiveisDesc')}
          aoTocar={() => ctx.navegar('Inventario')}
          ultimo
        />
      )}
    </Cartao>
  );
};
