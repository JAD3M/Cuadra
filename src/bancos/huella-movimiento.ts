// src/bancos/huella-movimiento.ts
import { createHash } from 'node:crypto';
import { dinero } from '../common/dinero';
import { normalizarReferencia } from '../conciliacion/referencia-normalizer';

/**
 * Versión del algoritmo. Va en el prefijo de la huella y en lo que se hashea:
 * si cambia la canonicalización se sube la versión y las huellas viejas dejan
 * de coincidir con las nuevas en vez de coincidir por error.
 */
export const HUELLA_VERSION = 'v1';

/** Separador de campos. Ningún campo canónico puede contener '|'. */
const SEPARADOR = '|';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface EntradaHuella {
  /** Cuenta tal como llegó; null o vacía es válida (no todo archivo la trae). */
  cuenta: string | null | undefined;
  /** YYYY-MM-DD. */
  fecha: string;
  /** Texto decimal con signo; nunca `number`. */
  monto: string;
  referencia: string | null | undefined;
}

/** Trim, solo alfanuméricos ASCII, mayúsculas. Nulo o vacío es ''. */
function normalizarCuenta(cuenta: string | null | undefined): string {
  return (cuenta ?? '').replace(/[^A-Za-z0-9]/gu, '').toUpperCase();
}

/** Exactamente 4 decimales; el cero negativo se escribe como cero. */
function montoCanonico(monto: string): string {
  const valor = dinero(monto);
  return valor.isZero() ? '0.0000' : valor.toFixed(4);
}

/**
 * Huella de un movimiento bancario (FR-65): `v1:` + sha256 hex de
 * `v1|cuenta|fecha|monto|referencia`, con cuenta normalizada, fecha ISO, monto
 * a 4 decimales y referencia normalizada (`normalizarReferencia`, nula es '').
 *
 * Todos los campos canónicos son alfanuméricos, dígitos, '-', '.', así que el
 * separador '|' hace la codificación inequívoca: correr un carácter de un
 * campo al vecino cambia el texto hasheado.
 *
 * Debe dar lo mismo que la función SQL `huella_movimiento` (backfill de la
 * migración); la prueba de paridad lo vigila.
 */
export function huellaMovimiento(entrada: EntradaHuella): string {
  if (!FECHA_ISO.test(entrada.fecha)) {
    throw new Error(`"${entrada.fecha}" no es una fecha YYYY-MM-DD`);
  }
  const texto = [
    HUELLA_VERSION,
    normalizarCuenta(entrada.cuenta),
    entrada.fecha,
    montoCanonico(entrada.monto),
    normalizarReferencia(entrada.referencia) ?? '',
  ].join(SEPARADOR);
  const digest = createHash('sha256').update(texto, 'utf8').digest('hex');
  return `${HUELLA_VERSION}:${digest}`;
}

/**
 * Exacto vs dudoso: dos movimientos con la misma huella son EXACTOS si además
 * traen la misma referencia cruda (solo recortada; nulo y '' son iguales) y
 * DUDOSOS si la referencia cruda difiere, porque la huella la normaliza y
 * puede juntar referencias que el banco escribió distinto.
 */
export function mismaReferenciaCruda(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? '').trim() === (b ?? '').trim();
}
