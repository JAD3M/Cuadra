import { ApiError, NetworkError } from '@/shared/api';

// Clasificadores propios de Cargas: `mensajeDeError` no distingue un rechazo
// (400) de un 413 y sirve a otras pantallas, así que no se toca. Devuelven solo
// una clase; el texto sale de `textos.ts` y de los textos compartidos de la
// bandeja. El único texto del servidor que se conserva es el motivo de un 400,
// y se muestra como texto plano.

export type ClaseErrorSubida =
  /** `detalle`: motivo del servidor; `null` si no mandó ninguno. */
  | { clase: 'rechazo'; detalle: string | null }
  | { clase: 'demasiado_grande' }
  | { clase: 'sin_permiso' }
  | { clase: 'conexion' }
  | { clase: 'otro' };

export type ErrorLecturaCargas = 'sin_permiso' | 'conexion';

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Clase del fallo de una subida. `null` para una cancelación y para un 401: ni
 * uno ni otro muestran mensaje (el 401 lo atiende la capa de sesión). El 413 se
 * decide por el código, nunca por la forma del cuerpo (un proxy responde HTML).
 */
export function clasificarErrorSubida(error: unknown): ClaseErrorSubida | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 400: {
        // class-validator puede devolver varios mensajes (M8).
        const detalle = error.mensajes.join(' ').trim();
        return { clase: 'rechazo', detalle: detalle === '' ? null : detalle };
      }
      case 413:
        return { clase: 'demasiado_grande' };
      case 403:
        return { clase: 'sin_permiso' };
      default:
        return { clase: 'otro' };
    }
  }
  if (error instanceof NetworkError) {
    return { clase: 'conexion' };
  }
  return { clase: 'otro' };
}

/**
 * Clase del fallo de una lectura (lista, detalle, perfiles), igual que CU-23:
 * 403 sin permiso, 401 y cancelación sin mensaje, el resto conexión.
 */
export function clasificarErrorLectura(
  error: unknown,
): ErrorLecturaCargas | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    if (error.statusCode === 401) return null;
    if (error.statusCode === 403) return 'sin_permiso';
  }
  return 'conexion';
}
