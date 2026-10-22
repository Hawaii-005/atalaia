/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // As cores vêm de variáveis CSS (triplos "r g b") definidas em
        // src/theme/temas.ts e aplicadas na raiz com `vars()` do NativeWind.
        // Trocar de tema é trocar as variáveis, sem tocar nas classNames.
        canvas: {
          DEFAULT: 'rgb(var(--fundo) / <alpha-value>)',
          sunken: 'rgb(var(--fundo-baixo) / <alpha-value>)',
        },
        cartao: 'rgb(var(--cartao) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--tinta) / <alpha-value>)',
          soft: 'rgb(var(--tinta-soft) / <alpha-value>)',
          muted: 'rgb(var(--tinta-muted) / <alpha-value>)',
        },
        line: 'rgb(var(--linha) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--acento) / <alpha-value>)',
          dark: 'rgb(var(--acento-forte) / <alpha-value>)',
          soft: 'rgb(var(--acento-suave) / <alpha-value>)',
        },
        state: {
          ok: 'rgb(var(--ok) / <alpha-value>)',
          light: 'rgb(var(--aviso) / <alpha-value>)',
          danger: 'rgb(var(--perigo) / <alpha-value>)',
        },
      },
      borderRadius: { xl2: '18px' },
    },
  },
  plugins: [],
};
