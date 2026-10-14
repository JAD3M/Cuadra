// Espejo de `src/common/rfc.ts` del backend. Es solo una ayuda para la
// persona que escribe: quien decide si el RFC vale es el servidor. La prueba
// `tests/dominio/rfcEspejo.test.ts` vigila que no se separe del original.

/**
 * Patrón de RFC del SAT: 3 letras (moral) o 4 (física), fecha AAMMDD válida
 * en forma y homoclave de 3. Solo comprueba la forma, no la existencia.
 */
export const FORMATO_RFC =
  /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{2}[A\d]$/;

/** RFC genéricos del SAT (público en general y extranjeros). */
export const RFC_GENERICOS: readonly string[] = [
  'XAXX010101000',
  'XEXX010101000',
];

/** Quita todo espacio en blanco y pasa a mayúsculas, como el servidor. */
export function normalizarRfc(valor: string): string {
  return valor.replace(/\s+/g, '').toUpperCase();
}

export type MotivoRfcInvalido = 'formato' | 'generico';

export type ResultadoRfc =
  { valido: true } | { valido: false; motivo: MotivoRfcInvalido };

/** Valida un RFC ya normalizado (ver `normalizarRfc`). */
export function validarRfc(rfc: string): ResultadoRfc {
  if (!FORMATO_RFC.test(rfc)) return { valido: false, motivo: 'formato' };
  if (RFC_GENERICOS.includes(rfc)) return { valido: false, motivo: 'generico' };
  return { valido: true };
}
