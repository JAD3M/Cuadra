import { ApiError, NetworkError } from '@/shared/api';

// Clasificadores propios de la vista previa. Devuelven solo una clase: el
// texto sale de `textos.ts` y nunca del servidor. Un 401 lo atiende la capa de
// sesión y una cancelación no es un fallo: ambos dan `null` (sin mensaje).

export type ErrorLecturaVistaPrevia =
  'no_encontrada' | 'ya_resuelta' | 'sin_permiso' | 'conexion';

export type ErrorDecision =
  'no_encontrada' | 'ya_resuelta' | 'sin_permiso' | 'servidor' | 'red';

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
 * Fallo de aceptar o rechazar. Un corte de red (sin respuesta) es «red»: la
 * escritura pudo haberse aplicado, así que el texto no afirma lo contrario y
 * manda a revisar Cargas. Lo demás que no sea 404, 409 o 403 (500, contrato)
 * es «servidor»: el servidor respondió que falló y se puede reintentar.
 */
export function clasificarErrorDecision(error: unknown): ErrorDecision | null {
  if (esCancelacion(error)) return null;
  if (error instanceof NetworkError) return 'red';
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
