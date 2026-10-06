import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { reiniciarHandlers } from '@/test/handlers';
import { servidor } from '@/test/servidor';

// Con `globals: false` Testing Library no registra su limpieza sola.
afterEach(() => {
  cleanup();
});

// El `fetch` de Node (undici) no acepta URLs relativas, y el cliente usa la
// base relativa `/api` como en el navegador. Aquí se resuelve contra la
// ubicación de jsdom antes de llegar al fetch real. Solo afecta a las pruebas.
const fetchNode = globalThis.fetch.bind(globalThis);
globalThis.fetch = (entrada, opciones) => {
  if (typeof entrada === 'string' && entrada.startsWith('/')) {
    return fetchNode(new URL(entrada, globalThis.location.href), opciones);
  }
  return fetchNode(entrada, opciones);
};

// Toda petición sin manejador falla la prueba: nada sale a la red real.
beforeAll(() => {
  servidor.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  servidor.resetHandlers();
  reiniciarHandlers();
});
afterAll(() => {
  servidor.close();
});
