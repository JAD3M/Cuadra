import {
  ESTADOS_POR_DEFECTO,
  type EstadoBandeja,
} from '@/shared/dominio/bandeja';
import { ORDEN_ESTADOS } from './constantes';

// Estado de los filtros de la bandeja en la URL (`?estado=…&pagina=N`). La URL
// es lo que escribe cualquiera: se lee con tolerancia (un valor inválido se
// descarta, nunca llega a la API) y se escribe en una forma canónica única
// (los valores por defecto se omiten; los estados van en el orden de la pantalla).
// Así dos URL equivalentes se normalizan a la misma y el contenedor puede
// reescribir con `replace` sin crear historial.

export interface FiltrosBandeja {
  /** Siempre al menos uno, únicos y en el orden canónico. */
  estados: EstadoBandeja[];
  /** Entero desde 1. */
  pagina: number;
}

const PAGINA_VALIDA = /^[1-9]\d{0,5}$/;

/** Estados válidos y únicos en orden canónico; `null` si no queda ninguno. */
function estadosCanonicos(pedidos: readonly string[]): EstadoBandeja[] | null {
  const canonicos = ORDEN_ESTADOS.filter((e) => pedidos.includes(e));
  return canonicos.length > 0 ? canonicos : null;
}

function esPorDefecto(estados: readonly EstadoBandeja[]): boolean {
  return (
    estados.length === ESTADOS_POR_DEFECTO.length &&
    ESTADOS_POR_DEFECTO.every((e) => estados.includes(e))
  );
}

/**
 * Filtros a partir de la URL. Ausentes o inválidos dan los valores por
 * defecto (sugerencia y sin match, página 1); cualquier otra clave se ignora.
 */
export function leerFiltros(params: URLSearchParams): FiltrosBandeja {
  const pagina = params.get('pagina');
  return {
    estados: estadosCanonicos(params.getAll('estado')) ?? [
      ...ESTADOS_POR_DEFECTO,
    ],
    pagina: pagina !== null && PAGINA_VALIDA.test(pagina) ? Number(pagina) : 1,
  };
}

/**
 * Cadena de consulta canónica (sin `?`). Omite los valores por defecto: los
 * estados por defecto en cualquier orden y la página 1 dan una cadena vacía.
 */
export function serializar(filtros: FiltrosBandeja): string {
  const consulta = new URLSearchParams();
  const estados = estadosCanonicos(filtros.estados);
  if (estados !== null && !esPorDefecto(estados)) {
    for (const estado of estados) consulta.append('estado', estado);
  }
  if (Number.isSafeInteger(filtros.pagina) && filtros.pagina > 1) {
    consulta.set('pagina', String(filtros.pagina));
  }
  return consulta.toString();
}

/**
 * Enciende o apaga un estado y vuelve a la página 1. Devuelve `null` si
 * apagarlo dejaría la bandeja sin ningún estado: ese último no se puede
 * quitar.
 */
export function alternarEstado(
  filtros: FiltrosBandeja,
  estado: EstadoBandeja,
): FiltrosBandeja | null {
  const activo = filtros.estados.includes(estado);
  if (activo && filtros.estados.length === 1) return null;
  const siguientes = activo
    ? filtros.estados.filter((e) => e !== estado)
    : [...filtros.estados, estado];
  return {
    estados: ORDEN_ESTADOS.filter((e) => siguientes.includes(e)),
    pagina: 1,
  };
}
