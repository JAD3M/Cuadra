import { ApiError, NetworkError } from '@/shared/api';

// Clasificador del fallo al guardar la tolerancia. Devuelve solo una clase y
// jamás texto del servidor: el 400 de Nest nombra `toleranciaMonto` y es para
// quien desarrolla, así que `mensajes` no se lee. El texto sale de `textos.ts`.

export type ClaseErrorGuardado =
  'rechazo' | 'sin_permiso' | 'conexion' | 'otro';

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Clase del fallo de un PUT. `null` para una cancelación y para un 401: ni
 * uno ni otro muestran mensaje (el 401 lo atiende la capa de sesión). Se
 * decide por el código HTTP y el tipo de error, nunca por el cuerpo.
 */
export function clasificarErrorGuardado(
  error: unknown,
): ClaseErrorGuardado | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 400:
        return 'rechazo';
      case 403:
        return 'sin_permiso';
      default:
        return 'otro';
    }
  }
  if (error instanceof NetworkError) return 'conexion';
  return 'otro';
}
