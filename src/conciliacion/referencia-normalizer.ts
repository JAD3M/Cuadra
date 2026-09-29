// src/conciliacion/referencia-normalizer.ts

/** Una referencia normalizada de menos caracteres no sirve como llave (RN-3). */
export const LONGITUD_MINIMA_REFERENCIA = 3;

/**
 * RN-1. Debe dar lo mismo que la función SQL `normalizar_referencia` que
 * genera `movimientos.referencia_norm`; la prueba de paridad lo vigila.
 *
 *  1. Descarta todo lo que no sea [A-Za-z0-9] (acentos y no ASCII no se
 *     transliteran: se van).
 *  2. Mayúsculas.
 *  3. Quita los ceros a la izquierda solo del primer bloque de dígitos que
 *     sigue a las letras iniciales, dejando al menos un dígito.
 *  4. Vacío es `null`.
 *
 * Se usa [0-9] y nunca \d: en JS \d es ASCII, pero así queda idéntico al SQL.
 */
export function normalizarReferencia(
  texto: string | null | undefined,
): string | null {
  if (!texto) return null;
  const limpio = texto
    .replace(/[^A-Za-z0-9]/gu, '')
    .toUpperCase()
    .replace(/^([A-Z]*)0+(?=[0-9])/, '$1');
  return limpio === '' ? null : limpio;
}

export function esReferenciaUsable(norm: string | null): norm is string {
  return norm !== null && norm.length >= LONGITUD_MINIMA_REFERENCIA;
}

/**
 * RN-2. Llaves con las que un movimiento puede referirse a un CFDI: serie+folio
 * y folio solo. La serie se limpia sin quitar ceros ("A1" + "0005" es "A15").
 * El UUID fiscal nunca es llave. Sin folio no hay llaves.
 */
export function clavesDeCfdi(cfdi: {
  serie: string | null;
  folio: string | null;
}): string[] {
  const folio = normalizarReferencia(cfdi.folio);
  if (folio === null) return [];
  const serie = (cfdi.serie ?? '').replace(/[^A-Za-z0-9]/gu, '').toUpperCase();
  return [...new Set([serie + folio, folio])].filter(esReferenciaUsable);
}
