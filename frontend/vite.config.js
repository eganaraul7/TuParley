import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: { exportType: 'default', ref: true },
      include: '**/*.svg?react',
    }),
  ],

  server: {
    host: true,       // exponer en LAN — necesario para probar desde tablets reales
    port: 5173,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});