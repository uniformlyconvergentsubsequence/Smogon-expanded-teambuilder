import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Smogon-expanded-teambuilder/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/smogon-stats': {
        target: 'https://www.smogon.com/stats',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smogon-stats/, ''),
      },
    },
  },
});
