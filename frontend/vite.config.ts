import react from '@vitejs/plugin-react';
import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { construirProxy } from './config/proxy.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      proxy: construirProxy(env),
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    },
  };
});
