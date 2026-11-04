// src/conciliacion/huella-conjunto.ts
import { createHash } from 'node:crypto';

/**
 * Versión del algoritmo. Va en el prefijo de la huella y en lo que se hashea:
 * si cambia la canonicalización se sube la versión.
 */
export const HUELLA_CONJUNTO_VERSION = 'v1';

/** Separador de ids. Un uuid canónico no contiene '|'. */
const SEPARADOR = '|';

/**
 * Huella del conjunto de facturas de una decisión (AD-4): `v1:` + sha256 hex
 * de `v1|id1|id2|...`, con los ids en minúsculas (como los normaliza el tipo
 * `uuid` de Postgres) y ordenados ascendente. Es independiente del orden de
 * entrada; los duplicados se conservan; la lista vacía es válida. No muta la
 * entrada.
 *
 * Debe dar lo mismo que la función SQL `huella_conjunto`; la prueba de
 * paridad lo vigila.
 */
export function huellaConjunto(ids: readonly string[]): string {
  const ordenados = ids
    .map((id) => id.toLowerCase())
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const texto = `${HUELLA_CONJUNTO_VERSION}${SEPARADOR}${ordenados.join(SEPARADOR)}`;
  const digest = createHash('sha256').update(texto, 'utf8').digest('hex');
  return `${HUELLA_CONJUNTO_VERSION}:${digest}`;
}
