import type Decimal from 'decimal.js';
import { parsearMonto } from '@/shared/dinero';
import { DECIMALES_TOLERANCIA, TOLERANCIA_MAXIMA } from '@/shared/dominio';

/**
 * Por qué un borrador no se puede guardar. El texto de cada uno vive en
 * `textos.ts` (`MOTIVOS_INVALIDO`).
 */
export type MotivoInvalido = 'vacio' | 'formato' | 'rango' | 'decimales';

export type ResultadoValidacion =
  /** `valor`: el texto sin espacios en los extremos, dígitos intactos; es lo que se envía. */
  | { ok: true; valor: string; decimal: Decimal }
  | { ok: false; motivo: MotivoInvalido };

/**
 * Valida el texto que escribió la persona. Comodidad del navegador: el
 * servidor repite la validación. El orden decide el mensaje: vacío, formato
 * (dígitos con punto, sin coma, exponente ni letras), negativo (rango),
 * más de 4 decimales y, al final, mayor que el tope. Los decimales se cuentan
 * en el texto, no en el valor: `0.50000` trae 5 y el servidor lo rechaza.
 * Todo con decimal.js sobre cadenas; ningún monto pasa por flotante.
 */
export function validarTolerancia(texto: string): ResultadoValidacion {
  const valor = texto.trim();
  if (valor === '') return { ok: false, motivo: 'vacio' };

  const decimal = parsearMonto(valor);
  if (decimal === null) return { ok: false, motivo: 'formato' };

  // El servidor no acepta signo, tampoco "-0": se revisa el texto, no el valor.
  if (valor.startsWith('-')) return { ok: false, motivo: 'rango' };

  const decimales = valor.split('.')[1]?.length ?? 0;
  if (decimales > DECIMALES_TOLERANCIA) {
    return { ok: false, motivo: 'decimales' };
  }
  if (decimal.gt(TOLERANCIA_MAXIMA)) return { ok: false, motivo: 'rango' };

  return { ok: true, valor, decimal };
}

/**
 * ¿El borrador válido es el valor que ya tiene la empresa? Se compara como
 * decimal (0.5 es 0.50 es 0.5000). Un valor actual ilegible nunca es igual.
 */
export function esMismoValor(actual: string, valor: Decimal): boolean {
  return parsearMonto(actual)?.eq(valor) ?? false;
}
