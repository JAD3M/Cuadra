import { ApiError, mensajeDeError } from '@/shared/api';
import { TEXTOS_BANCOS } from './textos';

/** Fallo de levantar ya convertido en alerta de usuario. */
export interface FalloLevantar {
  titulo: string;
  detalle?: string;
}

/**
 * Convierte el error de `POST .../levantar-vista-previa` en una alerta. Solo el
 * 422 muestra el texto del servidor (dice cuántas cargas hay y cuántas faltan);
 * 409 y el resto tienen su copia. 401 y 403 no se explican aquí: la pantalla
 * termina la sesión (`null`).
 */
export function describirFalloLevantar(error: unknown): FalloLevantar | null {
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) return null;
    if (error.statusCode === 409) {
      return {
        titulo: TEXTOS_BANCOS.yaLevantadaTitulo,
        detalle: TEXTOS_BANCOS.yaLevantadaDetalle,
      };
    }
    if (error.statusCode === 422) {
      return {
        titulo: TEXTOS_BANCOS.sinEvidenciaTitulo,
        detalle: error.mensajes[0],
      };
    }
  }
  const mensaje = mensajeDeError(error);
  if (!mensaje) return null;
  return { titulo: mensaje.titulo, detalle: mensaje.detalle };
}
