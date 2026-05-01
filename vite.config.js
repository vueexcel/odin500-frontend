import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { PRODUCTION_API_ORIGIN } from './src/utils/apiOrigin.js';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('lightweight-charts')) return 'lightweight-charts';
          if (id.includes('d3-hierarchy')) return 'd3-hierarchy';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react-dom')) return 'react-dom';
          if (id.includes('react-router')) return 'react-router';
          if (id.includes('/react/') || id.includes('\\react\\')) return 'react-core';
          return 'vendor';
        }
      }
    }
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : []
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: PRODUCTION_API_ORIGIN,
        changeOrigin: true,
        secure: true
      }
    }
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
    allowedHosts: true
  }
}));
