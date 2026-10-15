import { ApiError, NetworkError } from '@/shared/api';

// Clasificador del fallo al invitar. Devuelve solo una clase y jamás texto del
// servidor: el 400 de Nest nombra campos y es para quien desarrolla. El texto
// sale de `textos.ts`. Se decide por el código HTTP y el tipo de error.

export type ClaseFalloInvitar =
  'correo' | 'permiso' | 'limite' | 'envio' | 'conexion' | 'otro';

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Clase del fallo de `POST /usuarios/invitaciones`. `null` para una
 * cancelación y para un 401: ni uno ni otro muestran mensaje (el 401 lo
 * atiende la capa de sesión).
 */
export function clasificarFalloInvitar(
  error: unknown,
): ClaseFalloInvitar | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 400:
        return 'correo';
      case 403:
        return 'permiso';
      case 429:
        return 'limite';
      case 503:
        return 'envio';
      default:
        return 'otro';
    }
  }
  if (error instanceof NetworkError) return 'conexion';
  return 'otro';
}
