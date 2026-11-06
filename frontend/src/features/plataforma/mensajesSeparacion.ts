import { ApiError, mensajeDeError } from '@/shared/api';
import { TEXTOS_SEPARACION } from './textos';

/** Fallo de cambiar la separación ya convertido en texto: bajo el campo o alerta. */
export type FalloSeparacion =
  | { donde: 'campo'; texto: string }
  | { donde: 'alerta'; titulo: string; detalle?: string };

/**
 * Convierte el error de `PUT /plataforma/empresas/:id/separacion-funciones`
 * en un fallo explicable. Nunca muestra el texto del servidor: 400 (motivo
 * sin valor) cae bajo el campo, 409 (ya estaba así) tiene su copia y el resto
 * va al mensaje general. 401 y 403 no se explican aquí: la pantalla termina
 * la sesión (`null`).
 */
export function describirFalloSeparacion(
  error: unknown,
): FalloSeparacion | null {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return null;
    if (error.statusCode === 400) {
      return { donde: 'campo', texto: TEXTOS_SEPARACION.motivoVacio };
    }
    if (error.statusCode === 409) {
      return {
        donde: 'alerta',
        titulo: TEXTOS_SEPARACION.yaEstabaTitulo,
        detalle: TEXTOS_SEPARACION.yaEstabaDetalle,
      };
    }
  }
  const mensaje = mensajeDeError(error);
  if (!mensaje) return null;
  return { donde: 'alerta', titulo: mensaje.titulo, detalle: mensaje.detalle };
}
