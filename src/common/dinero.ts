// src/common/dinero.ts
import Decimal from 'decimal.js';

/**
 * Único punto de aritmética de montos. Nada de `number`: 0.1 + 0.2 no da 0.3
 * en flotante, y un centavo de diferencia basta para conciliar mal.
 *
 * Instancia propia (clone) para no depender de la configuración global de
 * decimal.js. Redondeo half-up, el que usa el SAT.
 */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Dinero = Decimal;

/** Solo dígitos, punto opcional y signo opcional: nada de exponentes ni espacios. */
const DECIMAL_ESTRICTO = /^-?\d+(\.\d+)?$/;

export function esDecimal(texto: string): boolean {
  return DECIMAL_ESTRICTO.test(texto);
}

/** De texto a Dinero. Nunca recibe `number`: el monto ya habría perdido precisión. */
export function dinero(texto: string): Dinero {
  if (!esDecimal(texto)) {
    throw new Error(`"${texto}" no es un monto decimal válido`);
  }
  return new D(texto);
}

export const CERO: Dinero = new D(0);

export function sumar(montos: readonly Dinero[]): Dinero {
  return montos.reduce<Dinero>((total, monto) => total.plus(monto), CERO);
}

export function redondear(monto: Dinero, decimales: number): Dinero {
  return monto.toDecimalPlaces(decimales, D.ROUND_HALF_UP);
}

/** Texto sin notación científica, para mensajes y para NUMERIC. */
export function aTexto(monto: Dinero, decimales?: number): string {
  return decimales === undefined ? monto.toFixed() : monto.toFixed(decimales);
}
