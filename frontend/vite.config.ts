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
      // Los flujos montan la app completa (login, empresa, bandeja, caso) y
      // tardan de 1.5 a 2.6 s aislados en una máquina cargada; con dos suites
      // en paralelo pasan de los 5 s por defecto en `master` y en CU-23 por
      // igual. Más margen no oculta un cuelgue: sigue fallando a los 15 s.
      testTimeout: 15_000,
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    },
  };
});
