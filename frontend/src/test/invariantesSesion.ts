import { expect } from 'vitest';
import { CLAVE_TEMA } from '@/shared/tema';

/**
 * Invariante de la sesión por cookie: el token vive solo en la cookie
 * `httpOnly`, así que nada de la sesión puede estar en el almacenamiento del
 * navegador ni en una cookie legible. La única clave permitida es la del tema.
 * Se comprueba tras cada transición de las pruebas del proveedor.
 */
export function esperarSinRastroDeSesion(): void {
  const claves = Object.keys(window.localStorage).filter(
    (clave) => clave !== CLAVE_TEMA,
  );
  expect(claves, 'localStorage').toEqual([]);
  expect(window.sessionStorage.length, 'sessionStorage').toBe(0);
  expect(document.cookie, 'cookies legibles').toBe('');
}
