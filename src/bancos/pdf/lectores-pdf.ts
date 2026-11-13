import { leerEstadoCuentaBanorte } from './lector-banorte';
import { leerEstadoCuentaBbva } from './lector-bbva';
import type { EstadoCuentaLeido } from './lector-comun';
import { leerEstadoCuentaSantander } from './lector-santander';

type LectorPdf = (texto: string) => EstadoCuentaLeido;

/**
 * Registro de bancos con lector de PDF (AD-8): agregar un banco es una
 * entrada aquí. Cada lector es puro: recibe el texto ya extraído. El `nombre`
 * es lo que ve la persona en la pantalla de cargas (historia 8.3).
 */
const LECTORES = new Map<string, { nombre: string; leer: LectorPdf }>([
  ['bbva', { nombre: 'BBVA', leer: leerEstadoCuentaBbva }],
  ['banorte', { nombre: 'Banorte', leer: leerEstadoCuentaBanorte }],
  ['santander', { nombre: 'Santander', leer: leerEstadoCuentaSantander }],
]);

export const BANCOS_PDF: readonly string[] = [...LECTORES.keys()];

/** Los bancos con lector de PDF, con el nombre que ve la persona. */
export const BANCOS_PDF_CON_NOMBRE: ReadonlyArray<{
  id: string;
  nombre: string;
}> = [...LECTORES].map(([id, { nombre }]) => ({ id, nombre }));

/** `undefined` si el banco no tiene lector de PDF. */
export function lectorPdfDe(banco: string): LectorPdf | undefined {
  return LECTORES.get(banco.trim().toLowerCase())?.leer;
}
