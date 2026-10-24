import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TEMAS,
  TEMA_PREDEFINIDO,
  Tema,
  TemaId,
  variaveis,
} from '../theme/temas';

const CHAVE = 'temaApp';

interface ThemeContextType {
  tema: Tema;
  temaId: TemaId;
  setTema: (id: TemaId) => void;
  /** true quando o tema é escuro (StatusBar, barras do sistema) */
  escuro: boolean;
  /** variáveis CSS a aplicar na raiz com `vars()` do NativeWind */
  vars: Record<string, string>;
  /** compatibilidade com o código que já lia o esquema */
  colorScheme: 'light' | 'dark';
  theme: TemaId;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [temaId, _setTemaId] = useState<TemaId>(TEMA_PREDEFINIDO);

  useEffect(() => {
    const carregar = async () => {
      try {
        const guardado = (await AsyncStorage.getItem(CHAVE)) as TemaId | null;
        if (guardado && TEMAS[guardado]) {
          _setTemaId(guardado);
        } else if (guardado) {
          // Tema que já não existe (ex.: 'vidro', removido em 2.3.7).
          await AsyncStorage.removeItem(CHAVE);
        }
      } catch (e) {
        console.error('Falha ao ler o tema guardado', e);
      }
    };
    carregar();
  }, []);

  const setTema = async (id: TemaId) => {
    if (!TEMAS[id]) return;
    _setTemaId(id);
    try {
      await AsyncStorage.setItem(CHAVE, id);
    } catch (e) {
      console.error('Falha ao guardar o tema', e);
    }
  };

  const tema = TEMAS[temaId] ?? TEMAS[TEMA_PREDEFINIDO];

  return (
    <ThemeContext.Provider
      value={{
        tema,
        temaId,
        setTema,
        escuro: tema.escuro,
        vars: variaveis(tema),
        colorScheme: tema.escuro ? 'dark' : 'light',
        theme: temaId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { TEMAS };
export type { Tema, TemaId };
