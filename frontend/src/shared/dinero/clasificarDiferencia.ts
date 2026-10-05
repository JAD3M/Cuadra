import Decimal from 'decimal.js';
import { parsearMonto } from './parsearMonto';

export type ClaseDiferencia = 'sin_dato' | 'cero' | 'subcentavo' | 'distinta';

/** Por debajo de medio centavo, `formatearMonto` muestra `$0.00`. */
const MEDIO_CENTAVO = new Decimal('0.005');

/**
 * Clasifica la diferencia entre un movimiento y su CFDI sobre la cadena
 * original, sin redondear antes de comparar:
 * - `sin_dato`: ausente o no es un decimal válido.
 * - `cero`: exactamente cero (`-0` incluido).
 * - `subcentavo`: no es cero, pero se mostraría como `$0.00`.
 * - `distinta`: se muestra como un monto distinto de cero (`0.0050` ya es
 *   `$0.01`).
 *
 * Solo aritmética decimal: ningún monto pasa por `Number`.
 */
export function clasificarDiferencia(
  valor: string | null | undefined,
): ClaseDiferencia {
  if (typeof valor !== 'string') return 'sin_dato';
  const decimal = parsearMonto(valor);
  if (decimal === null) return 'sin_dato';
  if (decimal.isZero()) return 'cero';
  return decimal.abs().lt(MEDIO_CENTAVO) ? 'subcentavo' : 'distinta';
}
