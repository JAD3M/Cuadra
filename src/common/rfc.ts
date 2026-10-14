// src/common/rfc.ts

/**
 * Patrón de RFC del SAT: 3 letras (moral) o 4 (física), fecha AAMMDD válida
 * en forma, y homoclave de 3. Incluye Ñ y &, que sí existen en RFCs reales.
 * Solo comprueba la forma: no dice si el RFC existe ante el SAT.
 */
export const FORMATO_RFC =
  /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{2}[A\d]$/;

/**
 * RFC genéricos del SAT (público en general y extranjeros). Son válidos en un
 * CFDI, pero no identifican a una empresa: no se pueden dar de alta.
 */
export const RFC_GENERICOS: readonly string[] = [
  'XAXX010101000',
  'XEXX010101000',
];

/** Recorta, quita todo espacio en blanco y pasa a mayúsculas. */
export function normalizarRfc(valor: string): string {
  return valor.replace(/\s+/g, '').toUpperCase();
}

export type ResultadoRfc =
  | { valido: true }
  | { valido: false; motivo: 'formato' | 'generico'; mensaje: string };

/** Valida un RFC ya normalizado (ver `normalizarRfc`). */
export function validarRfc(rfc: string): ResultadoRfc {
  if (!FORMATO_RFC.test(rfc)) {
    return {
      valido: false,
      motivo: 'formato',
      mensaje:
        'El RFC tiene un formato inválido: son 12 caracteres (persona moral) o 13 (persona física), con fecha AAMMDD y homoclave',
    };
  }
  if (RFC_GENERICOS.includes(rfc)) {
    return {
      valido: false,
      motivo: 'generico',
      mensaje: `El RFC ${rfc} es genérico y no identifica a una empresa`,
    };
  }
  return { valido: true };
}
