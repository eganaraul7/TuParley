/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // paleta TuParley — usar estas en vez de arbitrary values [#...] en código nuevo
        fondo:     '#0f172a',
        panel:     '#1e293b',
        acento:    '#10b981',
        peligro:   '#ef4444',
        alerta:    '#f59e0b',
        info:      '#3b82f6',
        texto:     '#ffffff',
        secundario:'#94a3b8',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};