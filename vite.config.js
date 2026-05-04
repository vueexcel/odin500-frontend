import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function stripTrailingSlash(u) {
  return String(u || '').replace(/\/$/, '');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const prod = stripTrailingSlash(
    env.VITE_API_ORIGIN_PROD || 'https://trading-backend-production-b1b2.up.railway.app'
  );
  const dev = stripTrailingSlash(env.VITE_API_ORIGIN_DEV || 'http://localhost:5000');
  const apiMode = (env.VITE_API_MODE || 'prod').toLowerCase();
  const proxyTarget = apiMode === 'dev' ? dev : prod;

  return {
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
          target: proxyTarget,
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
  };
});
