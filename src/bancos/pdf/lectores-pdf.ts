import { leerEstadoCuentaBbva, type EstadoCuentaLeido } from './lector-bbva';

/**
 * Registro de bancos con lector de PDF (AD-8): agregar un banco es una
 * entrada aquí. Cada lector es puro: recibe el texto ya extraído.
 */
const LECTORES = new Map<string, (texto: string) => EstadoCuentaLeido>([
  ['bbva', leerEstadoCuentaBbva],
]);

export const BANCOS_PDF: readonly string[] = [...LECTORES.keys()];

/** `undefined` si el banco no tiene lector de PDF. */
export function lectorPdfDe(
  banco: string,
): ((texto: string) => EstadoCuentaLeido) | undefined {
  return LECTORES.get(banco.trim().toLowerCase());
}
