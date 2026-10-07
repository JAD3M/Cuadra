import { mensajeDeError } from '@/shared/api';

/** Por qué no se pudo leer la bitácora; nunca lleva texto del servidor. */
export type ClaseErrorBitacora = 'conexion' | 'sin_permiso' | 'otro';

/**
 * Clase del fallo de `GET /bitacora`, con el mismo criterio que el resto de
 * las pantallas (`mensajeDeError`): red, contrato roto y 5xx son conexión; 403
 * es falta de permiso; cualquier otro (un 400, por ejemplo) es «otro». Una
 * cancelación no es un fallo: `null`.
 */
export function clasificarErrorBitacora(
  error: unknown,
): ClaseErrorBitacora | null {
  const mensaje = mensajeDeError(error, 'general');
  if (mensaje === null) return null;
  if (mensaje.tipo === 'conexion') return 'conexion';
  if (mensaje.tipo === 'sin_permiso') return 'sin_permiso';
  return 'otro';
}
