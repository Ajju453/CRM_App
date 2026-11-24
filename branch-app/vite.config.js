import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forwards /api to the Express backend so the phone and dev server share one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
