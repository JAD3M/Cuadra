/**
 * Almacén de tokens en memoria. Es un cierre: los tokens no son propiedades
 * de ningún objeto, no se pueden alcanzar desde `window`, desde el árbol de
 * React, desde las cachés de consultas ni desde el estado del enrutador.
 *
 * Hay uno por proveedor de sesión (no es un módulo global), de modo que las
 * pruebas y los remontajes de StrictMode no comparten secretos.
 */
export interface AlmacenTokens {
  /** Token de selección (5 min). Solo lo leen las acciones de sesión. */
  seleccion(): string | null;
  /** Token de sesión (15 min). Es el único que ve el cliente de la API. */
  sesion(): string | null;
  /** Correo con el que se inició sesión; solo para rellenar el reingreso. */
  email(): string | null;
  fijarSeleccion(token: string, email: string): void;
  fijarSesion(token: string): void;
  /** Descarta todo: sesión, selección y correo. */
  limpiar(): void;
  /** Descarta solo el token de selección (y el correo que lo acompaña). */
  limpiarSeleccion(): void;
  /**
   * Lo único que se entrega al cliente de la API (`proveedorToken`). Nunca
   * devuelve el token de selección (M4).
   */
  proveedor(): () => string | null;
}

export function crearAlmacenTokens(): AlmacenTokens {
  let seleccion: string | null = null;
  let sesion: string | null = null;
  let email: string | null = null;

  return {
    seleccion: () => seleccion,
    sesion: () => sesion,
    email: () => email,
    fijarSeleccion(token, correo) {
      seleccion = token;
      email = correo;
    },
    fijarSesion(token) {
      sesion = token;
    },
    limpiar() {
      seleccion = null;
      sesion = null;
      email = null;
    },
    limpiarSeleccion() {
      seleccion = null;
      email = null;
    },
    proveedor: () => () => sesion,
  };
}
