import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { hexDe } from '../../../theme/temas';
import { t } from '../../../i18n';
import { Cartao, Linha, LinhaSwitch, Vazio } from '../componentes';
import { PropsSecao } from '../tipos';

export const SecaoDados = ({ ctx, visivel }: PropsSecao) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const nadaPrincipal =
    !visivel('dados.exportar') &&
    !visivel('dados.importar') &&
    !visivel('dados.diagnostico') &&
    !visivel('dados.timelapse');
  if (nadaPrincipal && !visivel('dados.boasVindas'))
    return <Vazio texto={t('settings.semResultados')} />;

  return (
    <View style={{ gap: 12 }}>
      {!nadaPrincipal && (
        <Cartao
          titulo={t('settings.seccaoDados')}
          icone="shield-checkmark-outline"
          cor={hexDe(paleta.acento)}
        >
          {visivel('dados.exportar') && (
            <Linha
              icone="share-outline"
              rotulo={t('settings.exportar')}
              ajuda={t('settings.exportarDesc')}
              aoTocar={ctx.exportar}
              ultimo={
                !visivel('dados.importar') &&
                !visivel('dados.diagnostico') &&
                !visivel('dados.timelapse')
              }
            />
          )}
          {visivel('dados.importar') && (
            <Linha
              icone="download-outline"
              rotulo={t('settings.importar')}
              ajuda={t('settings.importarDesc')}
              aoTocar={ctx.importar}
              ultimo={
                !visivel('dados.diagnostico') && !visivel('dados.timelapse')
              }
            />
          )}
          {visivel('dados.diagnostico') && (
            <Linha
              icone="document-text-outline"
              rotulo={t('settings.exportarDiagnostico')}
              ajuda={t('settings.exportarDiagnosticoDesc')}
              aoTocar={ctx.exportarDiagnostico}
              ultimo={!visivel('dados.timelapse')}
            />
          )}
          {visivel('dados.timelapse') && (
            <LinhaSwitch
              icone="film-outline"
              rotulo={t('settings.timelapseExperimental')}
              ajuda={t('settings.timelapseExperimentalDesc')}
              valor={ctx.timelapseExperimental}
              aoMudar={ctx.definirTimelapse}
              ultimo
            />
          )}
        </Cartao>
      )}

      {visivel('dados.boasVindas') && (
        <Cartao
          titulo={t('settings.seccaoManutencao')}
          icone="construct-outline"
          cor={hexDe(paleta.perigo)}
        >
          <Linha
            icone="refresh-outline"
            rotulo={t('settings.reiniciarBoasVindas')}
            ajuda={t('settings.reiniciarBoasVindasMsg')}
            aoTocar={ctx.reiniciarBoasVindas}
            perigoso
            ultimo
          />
        </Cartao>
      )}
    </View>
  );
};
