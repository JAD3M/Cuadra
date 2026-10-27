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

export type ClaseFalloAccionPendiente =
  'no_pendiente' | 'permiso' | 'limite' | 'envio' | 'conexion' | 'otro';

export interface FalloAccionPendiente {
  clase: ClaseFalloAccionPendiente;
  /**
   * Solo en `no_pendiente` por 409: el texto que el servidor manda («ya fue
   * aceptada», «ya no está pendiente»). Es un mensaje para la persona, no el
   * arreglo de validación de un 400, y el cuerpo no trae un código estable
   * con el que distinguirlos.
   */
  mensaje?: string;
}

/**
 * Clasifica el fallo de reenviar o cancelar una pendiente. 409: ya no es
 * pendiente, con el mensaje del servidor; 404: la invitación ya no existe en
 * la empresa (mismo texto genérico de «ya no está pendiente»). `null` para una
 * cancelación y para un 401, que atiende la capa de sesión.
 */
export function clasificarFalloAccionPendiente(
  error: unknown,
): FalloAccionPendiente | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 403:
        return { clase: 'permiso' };
      case 404:
        return { clase: 'no_pendiente' };
      case 409: {
        const mensaje = error.mensajes.find((m) => m.trim() !== '');
        return mensaje === undefined
          ? { clase: 'no_pendiente' }
          : { clase: 'no_pendiente', mensaje };
      }
      case 429:
        return { clase: 'limite' };
      case 503:
        return { clase: 'envio' };
      default:
        return { clase: 'otro' };
    }
  }
  if (error instanceof NetworkError) return { clase: 'conexion' };
  return { clase: 'otro' };
}

export type ClaseFalloRoles =
  'ultimo_admin' | 'no_encontrada' | 'permiso' | 'limite' | 'conexion' | 'otro';

/**
 * Clasifica el fallo de cambiar roles o quitar acceso (historia 2.6). 409: el
 * único administrador no se quita ni se degrada (por el código, no por el
 * texto del servidor); 404: la persona ya no tiene roles en la empresa. `null`
 * para una cancelación y para un 401, que atiende la capa de sesión. Nunca
 * devuelve texto del servidor.
 */
export function clasificarFalloRoles(error: unknown): ClaseFalloRoles | null {
  if (esCancelacion(error)) return null;
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401:
        return null;
      case 403:
        return 'permiso';
      case 404:
        return 'no_encontrada';
      case 409:
        return 'ultimo_admin';
      case 429:
        return 'limite';
      default:
        return 'otro';
    }
  }
  if (error instanceof NetworkError) return 'conexion';
  return 'otro';
}
