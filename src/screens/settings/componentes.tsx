import React, { useEffect, useState } from 'react';
import {
  KeyboardTypeOptions,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { hexDe } from '../../theme/temas';
import { t } from '../../i18n';

/** Altura mínima de toque recomendada (dp). */
export const ALVO_MINIMO = 48;

export const Cartao = ({
  titulo,
  icone,
  cor,
  children,
}: {
  titulo: string;
  icone: string;
  cor: string;
  children: React.ReactNode;
}) => (
  <View className="rounded-2xl border border-line bg-cartao overflow-hidden">
    <View className="flex-row items-center px-4 pt-3.5 pb-2">
      <View
        className="w-7 h-7 rounded-[9px] items-center justify-center"
        style={{ backgroundColor: cor + '1F' }}
      >
        <Ionicons name={icone as any} size={15} color={cor} />
      </View>
      <Text className="ml-2.5 text-[9px] tracking-[1.3px] font-bold text-ink-muted">
        {titulo.toUpperCase()}
      </Text>
    </View>
    {children}
  </View>
);

export const Linha = ({
  rotulo,
  ajuda,
  valor,
  aoTocar,
  perigoso,
  ultimo,
  icone,
  acento,
  controlo,
  desactivado,
  testID,
}: {
  rotulo: string;
  ajuda?: string;
  valor?: string;
  aoTocar?: () => void;
  perigoso?: boolean;
  ultimo?: boolean;
  icone?: string;
  acento?: string;
  /** Substitui o chevron (ex.: um Switch). */
  controlo?: React.ReactNode;
  desactivado?: boolean;
  testID?: string;
}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const cor = perigoso
    ? hexDe(paleta.perigo)
    : (acento ?? hexDe(paleta.acento));

  const conteudo = (
    <View
      className={`flex-row items-center px-4 ${ultimo ? '' : 'border-b border-line'}`}
      style={{ minHeight: ALVO_MINIMO, paddingVertical: 10 }}
    >
      {!!icone && (
        <View
          className="w-8 h-8 rounded-[10px] items-center justify-center"
          style={{ backgroundColor: cor + '1F' }}
        >
          <Ionicons name={icone as any} size={16} color={cor} />
        </View>
      )}
      <View className={`flex-1 pr-2 ${icone ? 'ml-3' : ''}`}>
        <Text
          className={`text-[13px] font-semibold ${
            perigoso ? 'text-state-danger' : 'text-ink'
          }`}
        >
          {rotulo}
        </Text>
        {!!ajuda && (
          <Text className="text-[10px] text-ink-soft mt-0.5 leading-[14px]">
            {ajuda}
          </Text>
        )}
      </View>
      {!!valor && (
        <Text className="text-[12px] font-semibold text-ink-soft mr-1">
          {valor}
        </Text>
      )}
      {controlo ??
        (aoTocar ? (
          <Ionicons
            name="chevron-forward"
            size={15}
            color={hexDe(paleta.tintaMuted)}
          />
        ) : null)}
    </View>
  );

  if (!aoTocar || desactivado) return conteudo;
  return (
    <TouchableOpacity
      onPress={aoTocar}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={ajuda}
      accessibilityState={{ disabled: !!desactivado }}
      testID={testID}
    >
      {conteudo}
    </TouchableOpacity>
  );
};

export const LinhaSwitch = ({
  rotulo,
  ajuda,
  valor,
  aoMudar,
  ultimo,
  icone,
  testID,
}: {
  rotulo: string;
  ajuda: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
  ultimo?: boolean;
  icone?: string;
  testID?: string;
}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  return (
    <Linha
      rotulo={rotulo}
      ajuda={ajuda}
      icone={icone}
      ultimo={ultimo}
      testID={testID}
      controlo={
        <Switch
          value={valor}
          onValueChange={aoMudar}
          accessibilityLabel={rotulo}
          trackColor={{
            false: hexDe(paleta.linha),
            true: hexDe(paleta.acento),
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={hexDe(paleta.linha)}
        />
      }
    />
  );
};

/** Linha com um campo numérico à direita (ex.: 15 %, 0,19 €/kWh). */
export const LinhaNumero = ({
  rotulo,
  ajuda,
  valor,
  unidade,
  aoGuardar,
  ultimo,
  icone,
  teclado = 'decimal-pad',
  testID,
}: {
  rotulo: string;
  ajuda?: string;
  valor: number;
  unidade?: string;
  aoGuardar: (valor: number) => void;
  ultimo?: boolean;
  icone?: string;
  teclado?: KeyboardTypeOptions;
  testID?: string;
}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  const [texto, setTexto] = useState(() => formatar(valor));

  // Se o valor mudar por fora (ex.: repor definições), o campo acompanha.
  useEffect(() => {
    setTexto(formatar(valor));
  }, [valor]);

  const confirmar = () => {
    const numero = Number.parseFloat(
      texto.replace(',', '.').replace(/[^0-9.]/g, '')
    );
    aoGuardar(Number.isFinite(numero) ? numero : valor);
  };

  return (
    <View
      className={`flex-row items-center px-4 ${ultimo ? '' : 'border-b border-line'}`}
      style={{ minHeight: ALVO_MINIMO, paddingVertical: 10 }}
    >
      {!!icone && (
        <View
          className="w-8 h-8 rounded-[10px] items-center justify-center"
          style={{ backgroundColor: hexDe(paleta.acento) + '1F' }}
        >
          <Ionicons
            name={icone as any}
            size={16}
            color={hexDe(paleta.acento)}
          />
        </View>
      )}
      <View className={`flex-1 pr-2 ${icone ? 'ml-3' : ''}`}>
        <Text className="text-[13px] font-semibold text-ink">{rotulo}</Text>
        {!!ajuda && (
          <Text className="text-[10px] text-ink-soft mt-0.5 leading-[14px]">
            {ajuda}
          </Text>
        )}
      </View>
      <View className="flex-row items-center">
        <TextInput
          value={texto}
          onChangeText={setTexto}
          onEndEditing={confirmar}
          keyboardType={teclado}
          placeholder="—"
          placeholderTextColor={hexDe(paleta.tintaMuted)}
          accessibilityLabel={rotulo}
          testID={testID}
          className="w-20 h-9 px-3 rounded-lg border border-line text-[12px] text-ink text-right"
          style={{
            borderColor: hexDe(paleta.linha),
            color: hexDe(paleta.tinta),
          }}
        />
        {!!unidade && (
          <Text className="text-[11px] text-ink-soft ml-1.5">{unidade}</Text>
        )}
      </View>
    </View>
  );
};

const formatar = (valor: number): string =>
  valor > 0 ? String(valor).replace('.', ',') : '';

/** Caixa de pesquisa no topo das definições. */
export const CampoPesquisa = ({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: string) => void;
}) => {
  const { tema } = useTheme();
  const paleta = tema.paleta;
  return (
    <View
      className="flex-row items-center rounded-xl border border-line bg-cartao px-3"
      style={{ minHeight: ALVO_MINIMO }}
    >
      <Ionicons
        name="search-outline"
        size={17}
        color={hexDe(paleta.tintaMuted)}
      />
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        placeholder={t('settings.pesquisa')}
        placeholderTextColor={hexDe(paleta.tintaMuted)}
        accessibilityLabel={t('settings.pesquisa')}
        returnKeyType="search"
        className="flex-1 ml-2 text-[13px] text-ink py-2"
        style={{ color: hexDe(paleta.tinta) }}
      />
      {valor.length > 0 && (
        <TouchableOpacity
          onPress={() => aoMudar('')}
          accessibilityRole="button"
          accessibilityLabel={t('settings.limparPesquisa')}
          hitSlop={8}
        >
          <Ionicons
            name="close-circle"
            size={17}
            color={hexDe(paleta.tintaMuted)}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

/** Texto de ajuda para listas vazias (pesquisa sem resultados). */
export const Vazio = ({ texto }: { texto: string }) => (
  <View className="items-center py-10 px-6">
    <Text className="text-[12px] text-ink-soft text-center leading-[18px]">
      {texto}
    </Text>
  </View>
);
