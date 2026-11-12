import { leerEstadoCuentaBanorte } from './lector-banorte';
import { leerEstadoCuentaBbva } from './lector-bbva';
import { leerEstadoCuentaSantander } from './lector-santander';
import type { EstadoCuentaLeido } from './lector-comun';

/**
 * Registro de bancos con lector de PDF (AD-8): agregar un banco es una
 * entrada aquí. Cada lector es puro: recibe el texto ya extraído.
 */
const LECTORES = new Map<string, (texto: string) => EstadoCuentaLeido>([
  ['bbva', leerEstadoCuentaBbva],
  ['banorte', leerEstadoCuentaBanorte],
  ['santander', leerEstadoCuentaSantander],
]);

export const BANCOS_PDF: readonly string[] = [...LECTORES.keys()];

/** `undefined` si el banco no tiene lector de PDF. */
export function lectorPdfDe(
  banco: string,
): ((texto: string) => EstadoCuentaLeido) | undefined {
  return LECTORES.get(banco.trim().toLowerCase());
}
