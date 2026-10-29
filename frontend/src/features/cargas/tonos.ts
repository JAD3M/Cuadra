import type { EstadoCarga } from '@/shared/dominio';
import type { TonoEstadoChip } from '@/shared/ui/EstadoChip';

// Rechazada es ámbar como «Con errores»: la descartó la persona (mockup 18).
// Cómo se pinta cada estado de una carga. Son `Record` sobre el espejo del
// dominio: un estado nuevo deja de compilar hasta que se le da tono y avance.

/** Tono del chip de estado de la tabla (Cargas.dc.html). */
export const TONO_ESTADO_CARGA: Readonly<Record<EstadoCarga, TonoEstadoChip>> =
  {
    pendiente: 'neutral',
    procesando: 'sugerencia',
    procesada: 'conciliado',
    con_errores: 'sin_match',
    fallida: 'peligro',
    pendiente_vista_previa: 'neutral',
    rechazada: 'sin_match',
  };

/**
 * Cómo se llena la barra de Avance: vacía (aún no empieza), indeterminada
 * (trabajando, sin porcentaje) o llena en el color del resultado. Sale solo del
 * estado, nunca de los contadores, que se escriben una sola vez al terminar.
 */
export type Avance = 'vacia' | 'indeterminada' | 'verde' | 'naranja' | 'roja';

export const AVANCE_ESTADO_CARGA: Readonly<Record<EstadoCarga, Avance>> = {
  pendiente: 'vacia',
  procesando: 'indeterminada',
  procesada: 'verde',
  con_errores: 'naranja',
  fallida: 'roja',
  pendiente_vista_previa: 'vacia',
  rechazada: 'naranja',
};
