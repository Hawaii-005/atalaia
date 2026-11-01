import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { hexDe } from '../../../theme/temas';
import { getPrintStatus } from '../../../types';
import { t } from '../../../i18n';
import { Cartao, Linha, Vazio } from '../componentes';
import { PropsSecao } from '../tipos';

export const SecaoImpressoras = ({ ctx, visivel }: PropsSecao) => {
  const { tema } = useTheme();
  const nenhuma =
    !visivel('impressoras.lista') && !visivel('impressoras.adicionar');
  if (nenhuma) return <Vazio texto={t('settings.semResultados')} />;

  const alvoAlternativo = ctx.printers[0];

  return (
    <Cartao
      titulo={t('settings.seccaoMaquinas')}
      icone="print-outline"
      cor={hexDe(tema.paleta.acento)}
    >
      {ctx.printers.length === 0
        ? visivel('impressoras.adicionar') && (
            <Linha
              icone="add-circle-outline"
              rotulo={t('settings.adicionarImpressora')}
              ajuda={t('settings.ajudaAdicionarImpressora')}
              aoTocar={() => ctx.navegar('AddEditPrinter')}
              ultimo
            />
          )
        : ctx.printers.map((pr, i) => {
            if (!visivel('impressoras.lista')) return null;
            const info = pr.status?.PrintInfo;
            const aCorrer =
              getPrintStatus(info?.Status ?? 0) === 'printing' &&
              !!info?.Filename;
            return (
              <Linha
                key={pr.id}
                icone={pr.kind === 'resin' ? 'layers-outline' : 'print-outline'}
                acento={pr.kind === 'resin' ? hexDe(tema.paleta.ok) : undefined}
                rotulo={pr.printerName}
                ajuda={`${pr.ipAddress} · ${
                  pr.connectionStatus === 'connected'
                    ? aCorrer
                      ? t('camera.aImprimir')
                      : t('camera.pronta')
                    : t('camera.impDesligada')
                }`}
                valor={
                  aCorrer ? `${Math.round(info?.Progress ?? 0)}%` : undefined
                }
                aoTocar={() =>
                  ctx.navegar('AddEditPrinter', { printerId: pr.id })
                }
                ultimo={
                  i === ctx.printers.length - 1 &&
                  !visivel('impressoras.alternativo')
                }
              />
            );
          })}

      {visivel('impressoras.adicionar') && ctx.printers.length > 0 && (
        <Linha
          icone="add-circle-outline"
          rotulo={t('settings.adicionarImpressora')}
          ajuda={t('settings.ajudaAdicionarImpressora')}
          aoTocar={() => ctx.navegar('AddEditPrinter')}
          ultimo={
            !visivel('impressoras.alternativo') || ctx.printers.length === 0
          }
        />
      )}

      {visivel('impressoras.alternativo') && ctx.printers.length > 0 && (
        <Linha
          icone="git-network-outline"
          rotulo={t('settings.enderecoAlternativo')}
          ajuda={t('settings.enderecoAlternativoDesc')}
          aoTocar={() =>
            ctx.navegar(
              'AddEditPrinter',
              alvoAlternativo ? { printerId: alvoAlternativo.id } : undefined
            )
          }
          ultimo
        />
      )}
    </Cartao>
  );
};
