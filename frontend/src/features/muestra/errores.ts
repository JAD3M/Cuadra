import { ApiError, ContratoError } from '@/shared/api';

// Clasificador propio de la marca: devuelve solo una clase y el texto sale de
// `textos.ts`, nunca del servidor.

export type ErrorMarca =
  'sin_permiso' | 'no_encontrado' | 'reabierta' | 'conexion' | 'generico';

/** Clase del fallo al marcar un caso; `null` para una cancelación. */
export function clasificarErrorMarca(error: unknown): ErrorMarca | null {
  if (error instanceof DOMException && error.name === 'AbortError') return null;
  if (error instanceof ContratoError) return 'conexion';
  if (!(error instanceof ApiError)) return 'conexion';
  switch (error.statusCode) {
    case 403:
      return 'sin_permiso';
    case 404:
      return 'no_encontrado';
    case 409:
      return 'reabierta';
    default:
      return error.statusCode >= 500 ? 'conexion' : 'generico';
  }
}
