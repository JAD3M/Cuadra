import {
  ACCIONES_ADMINISTRACION,
  ETIQUETAS_ACCION_BITACORA,
  type AccionBitacora,
} from '@/shared/dominio';

/**
 * Texto de una acción en el chip y en el filtro (Bitacora.dc.html): las cinco
 * de administración con su etiqueta en español y las demás con el valor de la
 * API, sin traducir.
 */
export function textoAccion(accion: AccionBitacora): string {
  return (ACCIONES_ADMINISTRACION as readonly string[]).includes(accion)
    ? ETIQUETAS_ACCION_BITACORA[accion]
    : accion;
}
