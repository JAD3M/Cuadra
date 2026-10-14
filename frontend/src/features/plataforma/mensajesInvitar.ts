import { ApiError, mensajeDeError } from '@/shared/api';
import { TEXTOS_INVITAR } from './textos';

/** Fallo de invitar ya convertido en texto: bajo el campo o como alerta. */
export type FalloInvitar =
  | { donde: 'campo'; texto: string }
  | { donde: 'alerta'; titulo: string; detalle?: string };

/**
 * Convierte el error de `POST /plataforma/empresas/:id/invitaciones` en un
 * fallo explicable. Nunca muestra el texto del servidor: 503 (el correo no
 * salió), 429 (límite) y 400 (correo sin forma válida) tienen su copia; el
 * resto cae en el mensaje general. 401 y 403 no se explican aquí: la pantalla
 * termina la sesión (`null`).
 */
export function describirFalloInvitar(error: unknown): FalloInvitar | null {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return null;
    if (error.statusCode === 503) {
      return {
        donde: 'alerta',
        titulo: TEXTOS_INVITAR.sinServicioTitulo,
        detalle: TEXTOS_INVITAR.sinServicioDetalle,
      };
    }
    if (error.statusCode === 429) {
      return {
        donde: 'alerta',
        titulo: TEXTOS_INVITAR.limiteTitulo,
        detalle: TEXTOS_INVITAR.limiteDetalle,
      };
    }
    if (error.statusCode === 400) {
      return { donde: 'campo', texto: TEXTOS_INVITAR.correoInvalido };
    }
  }
  const mensaje = mensajeDeError(error);
  if (!mensaje) return null;
  return { donde: 'alerta', titulo: mensaje.titulo, detalle: mensaje.detalle };
}
