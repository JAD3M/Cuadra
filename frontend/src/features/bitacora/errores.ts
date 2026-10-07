import { ApiError, NetworkError } from '@/shared/api';

// Clasificador del fallo al leer la bitácora. Devuelve solo una clase y jamás
// texto del servidor: `mensajes` no se lee y el texto sale de `textos.ts`.

export type ClaseErrorBitacora = 'conexion' | 'sin_permiso' | 'otro';

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Clase del fallo de una lectura. `null` para una cancelación y para un 401:
 * ni uno ni otro muestran mensaje (el 401 lo atiende la capa de sesión y la
 * pantalla sigue cargando). Se decide por el código HTTP y el tipo de error,
 * nunca por el cuerpo: un 5xx y un fallo de red son «conexion», un 403 es
 * «sin_permiso» y el resto, incluida una respuesta fuera de contrato, «otro».
 */
export function clasificarErrorBitacora(
  error: unknown,
): ClaseErrorBitacora | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return null;
    if (error.statusCode === 403) return 'sin_permiso';
    return error.statusCode >= 500 ? 'conexion' : 'otro';
  }
  if (error instanceof NetworkError) return 'conexion';
  return 'otro';
}
