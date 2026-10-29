// src/bancos/cuadre-saldos.ts
import { aTexto, dinero, sumar } from '../common/dinero';

export interface EntradaCuadre {
  /** Saldo inicial del periodo, en texto decimal. */
  saldoInicial: string;
  /** Saldo final del periodo, en texto decimal. */
  saldoFinal: string;
  /** Montos con signo: abonos positivos, cargos negativos. */
  montos: readonly string[];
}

export type ResultadoCuadre =
  | { cuadra: true }
  | {
      cuadra: false;
      /** saldoInicial + suma de montos. */
      saldoEsperado: string;
      /** saldoFinal - saldoEsperado. */
      diferencia: string;
    };

/**
 * Cuadre de un estado de cuenta, común a todos los bancos: el saldo inicial
 * más los movimientos debe dar el saldo final, sin tolerancia. Un centavo de
 * diferencia es un estado mal leído.
 *
 * Un texto que no es decimal lanza error (lo valida `dinero`): nunca se
 * toma como cuadrado.
 */
export function cuadrarSaldos(entrada: EntradaCuadre): ResultadoCuadre {
  const inicial = dinero(entrada.saldoInicial);
  const final = dinero(entrada.saldoFinal);
  const esperado = inicial.plus(sumar(entrada.montos.map(dinero)));
  if (esperado.equals(final)) {
    return { cuadra: true };
  }
  return {
    cuadra: false,
    saldoEsperado: aTexto(esperado),
    diferencia: aTexto(final.minus(esperado)),
  };
}
