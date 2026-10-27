import type { ResultadoDeCarga } from '@/shared/api/contratos';
import { LEYENDA_MONEDA_NO_SOPORTADA } from './textos';

// Marca de moneda no soportada (historia 3.1). El backend marca por archivo
// los CFDI cuya moneda no es MXN ni XXX; aquí solo se cuenta y se redacta.

export { LEYENDA_MONEDA_NO_SOPORTADA };

/** Etiqueta de la marca de un archivo: «⚠ Moneda no soportada · USD». */
export const etiquetaMonedaNoSoportada = (codigo: string): string =>
  `⚠ Moneda no soportada · ${codigo}`;

/** Cuántos archivos de una carga llevan la marca. */
export function contarMonedaNoSoportada(
  resultados: readonly ResultadoDeCarga[],
): number {
  return resultados.filter(
    (r) => 'monedaNoSoportada' in r && r.monedaNoSoportada === true,
  ).length;
}

/** Nota del historial: «⚠ 2 con moneda no soportada»; `null` si no hay marcas. */
export function notaMonedaHistorial(cantidad: number): string | null {
  return cantidad > 0 ? `⚠ ${cantidad} con moneda no soportada` : null;
}
