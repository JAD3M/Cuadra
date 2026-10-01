import Decimal from 'decimal.js';
import { parsearMonto } from './parsearMonto';

export interface MontoFormateado {
  texto: string;
  negativo: boolean;
}

export interface OpcionesFormato {
  /** Antepone el signo de peso. Por defecto `true`. */
  moneda?: boolean;
}

const MENOS = '−';

/**
 * Da formato es-MX a un monto decimal en cadena: miles con coma, dos
 * decimales, redondeo ROUND_HALF_UP y `$` como prefijo. El negativo lleva el
 * signo menos U+2212 antes del `$`. Un valor que redondea a cero nunca es
 * negativo. Devuelve `null` si la cadena no es un decimal válido.
 *
 * Solo aritmética decimal: ningún monto pasa por `Number`.
 */
export function formatearMonto(
  valor: string,
  opciones: OpcionesFormato = {},
): MontoFormateado | null {
  const decimal = parsearMonto(valor);
  if (decimal === null) return null;

  const fijo = decimal.toFixed(2, Decimal.ROUND_HALF_UP);
  const negativoCrudo = fijo.startsWith('-');
  const sinSigno = negativoCrudo ? fijo.slice(1) : fijo;
  const [entero = '0', fraccion = '00'] = sinSigno.split('.');
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const esCero = /^0\.00$/.test(`${entero}.${fraccion}`);
  const negativo = negativoCrudo && !esCero;
  const prefijo = opciones.moneda === false ? '' : '$';

  return {
    texto: `${negativo ? MENOS : ''}${prefijo}${agrupado}.${fraccion}`,
    negativo,
  };
}
