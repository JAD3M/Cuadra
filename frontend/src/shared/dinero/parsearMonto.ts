import Decimal from 'decimal.js';

/**
 * Forma válida de un monto que llega de la API: entero o decimal con signo
 * opcional, sin separadores de miles, sin exponente, sin prefijo `+`.
 * Los contratos zod (slice 7) importan este mismo patrón.
 */
export const PATRON_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Convierte una cadena decimal estricta en `Decimal`; devuelve `null` si la
 * cadena no cumple el patrón. La validación va ANTES de construir el
 * `Decimal` porque decimal.js acepta `0x1F`, `1e3`, `NaN` e `Infinity`.
 */
export function parsearMonto(valor: string): Decimal | null {
  if (typeof valor !== 'string' || !PATRON_DECIMAL.test(valor)) return null;
  return new Decimal(valor);
}
