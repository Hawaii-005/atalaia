import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useSelectedPrinter } from '../contexts/SelectedPrinterContext';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { navegacaoRef } from '../navigation/navegacaoRef';
import { t } from '../i18n';
import {
  FicheiroPartilhado,
  lerPartilha,
  ouvirPartilha,
  tipoDoFicheiro,
} from '../utils/partilha';

const espera = (ms: number) =>
  new Promise(resolver => {
    setTimeout(resolver, ms);
  });

/**
 * Recolhe os ficheiros que o Android entrega à Atalaia pelo «Partilhar».
 *
 * Vive no topo da app (e não na aba Ficheiros) porque a app pode abrir em
 * qualquer aba: é preciso mudar de ecrã, escolher máquina e só depois deixar
 * o FilesScreen tratar do envio.
 */
export const ReceberPartilha = () => {
  const { maquina, mudarMaquina, mudarSecao, definirPartilhado } =
    useSelectedPrinter();
  const { printers } = usePrinterConnections();
  const estado = useRef({ printers, maquina });

  useEffect(() => {
    estado.current = { printers, maquina };
  }, [printers, maquina]);

  const tratar = useCallback(
    async (ficheiro: FicheiroPartilhado) => {
      if (tipoDoFicheiro(ficheiro.nome) !== 'gcode') {
        Alert.alert(
          t('files.partilhaTitulo'),
          tipoDoFicheiro(ficheiro.nome) === 'modelo'
            ? t('files.partilhaModelo', { nome: ficheiro.nome })
            : t('files.partilhaOutro', { nome: ficheiro.nome })
        );
        return;
      }

      // A lista de impressoras vem do armazenamento e pode chegar uns
      // instantes depois do intent: espera por ela antes de desistir.
      let { printers: lista, maquina: actual } = estado.current;
      for (let i = 0; i < 10 && lista.length === 0; i += 1) {
        await espera(300);
        lista = estado.current.printers;
        actual = estado.current.maquina;
      }

      const alvo =
        actual ??
        lista.find(p => p.connectionStatus === 'connected') ??
        lista[0];
      if (!alvo) {
        Alert.alert(
          t('files.partilhaTitulo'),
          t('files.partilhaSemImpressora')
        );
        return;
      }
      if (!actual) mudarMaquina(alvo.id);

      definirPartilhado(ficheiro);
      mudarSecao('ficheiros');
      if (navegacaoRef.isReady()) navegacaoRef.navigate('Impressora');
    },
    [mudarMaquina, mudarSecao, definirPartilhado]
  );

  const lerCaixa = useCallback(async () => {
    const lista = await lerPartilha();
    // Um de cada vez: o envio é um só e a impressora mostra a lista toda.
    if (lista.length > 0) tratar(lista[0]);
  }, [tratar]);

  // Arranque por partilha: o ficheiro já está na caixa nativa.
  useEffect(() => {
    lerCaixa();
  }, [lerCaixa]);

  // App já aberta noutra aba.
  useEffect(() => ouvirPartilha(() => lerCaixa()), [lerCaixa]);

  return null;
};
