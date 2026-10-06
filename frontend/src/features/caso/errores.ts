import { ApiError, ContratoError } from '@/shared/api';

// Clasificadores propios del detalle: `mensajeDeError` no distingue contrato,
// no encontrado ni conflicto y sirve a otras pantallas, así que no se toca.
// Devuelven solo una clase: el texto sale de `textos.ts` y nunca del servidor.

export type AccionCaso = 'confirmar' | 'rechazar';

export type ErrorLectura =
  'no_encontrado' | 'sin_permiso' | 'contrato' | 'conexion';

export type ErrorAccion =
  | 'motivo_largo'
  | 'segregacion'
  | 'sin_permiso'
  | 'no_encontrado'
  | 'conflicto'
  | 'conexion'
  | 'contrato'
  | 'generico';

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Clase del fallo de la lectura del caso. `null` para una cancelación y para
 * un 401: ninguno muestra mensaje (el 401 lo atiende la capa de sesión).
 */
export function clasificarErrorLectura(error: unknown): ErrorLectura | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ContratoError) return 'contrato';
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return null;
    if (error.statusCode === 404 || error.statusCode === 400) {
      return 'no_encontrado';
    }
    if (error.statusCode === 403) return 'sin_permiso';
  }
  return 'conexion';
}

/** Clase del fallo al confirmar o rechazar. */
export function clasificarErrorAccion(
  error: unknown,
  accion: AccionCaso,
): ErrorAccion {
  if (error instanceof ContratoError) return 'contrato';
  if (!(error instanceof ApiError)) return 'conexion';
  switch (error.statusCode) {
    case 400:
      return 'motivo_largo';
    case 403:
      return accion === 'confirmar' ? 'segregacion' : 'sin_permiso';
    case 404:
      return 'no_encontrado';
    case 409:
      return 'conflicto';
    default:
      return error.statusCode >= 500 ? 'conexion' : 'generico';
  }
}
