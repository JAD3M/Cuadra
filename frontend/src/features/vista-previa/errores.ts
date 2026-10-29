import { ApiError } from '@/shared/api';

// Clasificadores propios de la vista previa. Devuelven solo una clase: el
// texto sale de `textos.ts` y nunca del servidor. Un 401 lo atiende la capa de
// sesión y una cancelación no es un fallo: ambos dan `null` (sin mensaje).

export type ErrorLecturaVistaPrevia =
  'no_encontrada' | 'ya_resuelta' | 'sin_permiso' | 'conexion';

export type ErrorDecision =
  'no_encontrada' | 'ya_resuelta' | 'sin_permiso' | 'servidor';

function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Fallo de `GET /cargas/:id/vista-previa`. Un 400 (id que no es uuid) y un 404
 * son lo mismo para la persona: esa carga no existe para ella. Un 409 es una
 * carga que ya salió de la espera.
 */
export function clasificarErrorLectura(
  error: unknown,
): ErrorLecturaVistaPrevia | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 400:
      case 404:
        return 'no_encontrada';
      case 409:
        return 'ya_resuelta';
      case 403:
        return 'sin_permiso';
    }
  }
  return 'conexion';
}

/**
 * Fallo de aceptar o rechazar. Todo lo que no sea 404, 409 o 403 (500, red,
 * contrato) es «servidor»: no se sabe si se escribió algo, así que el texto
 * dice que no se aceptó nada y la pantalla deja volver a intentar.
 */
export function clasificarErrorDecision(error: unknown): ErrorDecision | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 404:
        return 'no_encontrada';
      case 409:
        return 'ya_resuelta';
      case 403:
        return 'sin_permiso';
    }
  }
  return 'servidor';
}
