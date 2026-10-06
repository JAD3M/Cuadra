import type { EstadoBandeja } from '@/shared/dominio/bandeja';

/** Filas por página de la bandeja. El máximo del backend es `LIMITE_MAXIMO`. */
export const LIMITE_PAGINA = 20;

/** Moneda de referencia: solo las demás muestran su código junto al monto. */
export const MONEDA_BASE = 'MXN';

/**
 * Orden en que la pantalla muestra los estados (chips, tarjetas y URL), el del
 * mockup. El espejo del backend guarda otro orden; este solo los reacomoda.
 */
export const ORDEN_ESTADOS: readonly EstadoBandeja[] = [
  'sugerencia',
  'sin_match',
  'conciliado',
];
