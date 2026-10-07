/** Controles de página que cabe mostrar a la vez (con elipsis incluidas). */
const CONTROLES_MAXIMOS = 7;

/** Un número de página, o `null` para una elipsis. */
export type ElementoVentana = number | null;

/**
 * Ventana de páginas de la paginación: siempre la primera, la última y la
 * actual con sus vecinas, con elipsis (`null`) en los huecos. Nunca repite una
 * página y nunca pasa de siete elementos, sin importar cuántas páginas haya.
 */
export function ventanaDePaginas(
  actual: number,
  totalPaginas: number,
): ElementoVentana[] {
  const rango = (desde: number, hasta: number): number[] =>
    Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

  if (totalPaginas <= CONTROLES_MAXIMOS) return rango(1, totalPaginas);
  if (actual <= 4) return [...rango(1, 5), null, totalPaginas];
  if (actual >= totalPaginas - 3) {
    return [1, null, ...rango(totalPaginas - 4, totalPaginas)];
  }
  return [1, null, actual - 1, actual, actual + 1, null, totalPaginas];
}

/** Última página que existe para `total` filas; nunca menos de 1. */
export function paginaMaxima(total: number, limite: number): number {
  return Math.max(1, Math.floor((total + limite - 1) / limite));
}
