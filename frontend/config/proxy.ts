import type { ProxyOptions } from 'vite';

const API_TARGET_POR_OMISION = 'http://localhost:3000';

/**
 * Proxy de desarrollo: el navegador llama a `/api/*` y Vite lo reenvía al API
 * sin el prefijo. El backend no necesita CORS. `API_TARGET` no lleva prefijo
 * VITE_ para que nunca se incluya en el bundle.
 */
export function construirProxy(
  env: Record<string, string | undefined>,
): Record<string, ProxyOptions> {
  const target = env.API_TARGET || API_TARGET_POR_OMISION;
  return {
    '/api': {
      target,
      changeOrigin: true,
      rewrite: (ruta) => ruta.replace(/^\/api/, ''),
    },
  };
}
