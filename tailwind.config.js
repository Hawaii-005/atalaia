/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Direction B "Bare metal" — light canvas, ink text, one action blue.
        canvas: { DEFAULT: '#FFFFFF', sunken: '#F4F4F4' },
        ink: { DEFAULT: '#171A20', soft: '#3F444D', muted: '#63676E' },
        line: '#E4E4E4',
        brand: { DEFAULT: '#3E6AE1', dark: '#2F55C4', soft: '#EDF1FC' },
        state: { ok: '#1F9D55', light: '#F2A900', danger: '#C62828' },
      },
      borderRadius: { xl2: '18px' },
    },
  },
  plugins: [],
};
