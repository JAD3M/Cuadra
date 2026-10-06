import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { reiniciarHandlers } from '@/test/handlers';
import { servidor } from '@/test/servidor';

// `findBy*` y `waitFor` esperan 1 s por defecto; bajo carga de CPU los flujos
// de la app completa lo pasan sin que haya nada mal. Se da el mismo margen
// relativo que al límite de cada prueba.
configure({ asyncUtilTimeout: 3_000 });

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

// Spike M18 / ADR-6. El parser multipart de undici (`request.formData()` en los
// manejadores de MSW) construye sus partes con el `File` global y comprueba su
// marca; con el `File` de jsdom falla (`webidl.is.File`) y MSW responde 500.
// Se restauran `File`, `Blob` y `FormData` nativos solo para las pruebas:
// `File` y `Blob` de `node:buffer` (por `process.getBuiltinModule`, así `src`
// no necesita los tipos de Node) y `FormData` la clase que produce una
// `Response` nativa. Los globales de jsdom son accesores que escriben en su
// `window`, y Vitest usa `window.Blob`/`window.FormData` para reconocer lo que
// debe convertir; por eso se redefinen como propiedades propias en vez de
// asignarse. `userEvent.upload` solo necesita un `File`, que el nativo cumple.
const { Blob: BlobNativo, File: FileNativo } = (
  globalThis as unknown as {
    process: {
      getBuiltinModule(id: 'node:buffer'): {
        Blob: typeof Blob;
        File: typeof File;
      };
    };
  }
).process.getBuiltinModule('node:buffer');
const formularioNativo = await new Response('a=1', {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
}).formData();
for (const [nombre, valor] of [
  ['Blob', BlobNativo],
  ['File', FileNativo],
  ['FormData', formularioNativo.constructor],
] as const) {
  Object.defineProperty(globalThis, nombre, {
    value: valor,
    writable: true,
    configurable: true,
  });
}

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
