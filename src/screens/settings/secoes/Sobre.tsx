import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { hexDe } from '../../../theme/temas';
import { t } from '../../../i18n';
import { Cartao, Linha, Vazio } from '../componentes';
import { PropsSecao } from '../tipos';

export const SecaoSobre = ({ ctx, visivel }: PropsSecao) => {
  const { tema } = useTheme();
  const nada =
    !visivel('sobre.versao') &&
    !visivel('sobre.github') &&
    !visivel('sobre.issues') &&
    !visivel('sobre.licenca');
  if (nada) return <Vazio texto={t('settings.semResultados')} />;

  return (
    <View style={{ gap: 12 }}>
      <Cartao
        titulo={t('settings.seccaoSobre')}
        icone="information-circle-outline"
        cor={hexDe(tema.paleta.acento)}
      >
        {visivel('sobre.versao') && (
          <Linha
            icone="pricetag-outline"
            rotulo={t('settings.versaoApp')}
            valor={ctx.versao || '—'}
            ultimo={
              !visivel('sobre.github') &&
              !visivel('sobre.issues') &&
              !visivel('sobre.licenca')
            }
          />
        )}
        {visivel('sobre.github') && (
          <Linha
            icone="logo-github"
            rotulo="GitHub"
            aoTocar={() =>
              ctx.abrirUrl('https://github.com/Hawaii-005/atalaia')
            }
            ultimo={!visivel('sobre.issues') && !visivel('sobre.licenca')}
          />
        )}
        {visivel('sobre.issues') && (
          <Linha
            icone="bug-outline"
            rotulo={t('settings.comunicarProblema')}
            aoTocar={() =>
              ctx.abrirUrl('https://github.com/Hawaii-005/atalaia/issues')
            }
            ultimo={!visivel('sobre.licenca')}
          />
        )}
        {visivel('sobre.licenca') && (
          <Linha
            icone="document-text-outline"
            rotulo={t('settings.licenca')}
            valor="MIT"
            ultimo
          />
        )}
      </Cartao>

      <Text className="px-2 text-[11px] leading-[17px] text-ink-muted text-center">
        {t('settings.avisoComunidade')}
      </Text>
    </View>
  );
};
