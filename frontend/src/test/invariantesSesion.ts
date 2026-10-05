import { expect } from 'vitest';
import type { AlmacenTokens } from '@/shared/sesion/almacenTokens';
import type { EstadoInterno } from '@/shared/sesion/maquina';

/**
 * Invariantes entre la fase de la sesión y los tokens guardados (SA-1, SA-4):
 * - token de sesión <=> fase `sesion`, o `selecting` con origen `cambio`;
 * - token de selección <=> fase `selecting` o `sesion`;
 * - `anonymous` y `ended` no conservan ningún token.
 * Se comprueba tras cada transición de las pruebas del proveedor.
 */
export function esperarTokensCoherentes(
  estado: EstadoInterno,
  almacen: AlmacenTokens,
): void {
  const sesionViva =
    estado.fase === 'sesion' ||
    (estado.fase === 'selecting' && estado.origen === 'cambio');
  const seleccionViva = estado.fase === 'selecting' || estado.fase === 'sesion';
  expect(almacen.sesion() !== null, `token de sesión en ${estado.fase}`).toBe(
    sesionViva,
  );
  expect(
    almacen.seleccion() !== null,
    `token de selección en ${estado.fase}`,
  ).toBe(seleccionViva);
}
