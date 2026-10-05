import { REGLA_LLM_SUGERENCIA } from '@/shared/dominio';

/**
 * Prefijo completo con el que el backend guarda el motivo de una sugerencia del
 * proveedor simulado: `PREFIJO_MOTIVO` + `ETIQUETA_SIMULADA`. Una prueba
 * estática (tests/dominio/prefijoSimulada.test.ts) compara esta constante con
 * las dos del backend para que no se desincronicen.
 */
export const PREFIJO_MOTIVO_SIMULADO =
  'Sugerencia de IA: [SIMULADA — no es un modelo real]';

export type TipoInsigniaIa = 'ia' | 'ia_simulada';

/**
 * Decide la insignia de IA de una fila. Solo la regla `llm_sugerencia` lleva
 * insignia, y solo es «simulada» cuando el motivo EMPIEZA con el prefijo
 * completo guardado: la etiqueta sola, o el prefijo en medio del texto, no
 * bastan. Cualquier otra regla (incluso una desconocida) no lleva insignia.
 */
export function insigniaIa(
  regla: string | null,
  motivo: string | null,
): TipoInsigniaIa | null {
  if (regla !== REGLA_LLM_SUGERENCIA) return null;
  return motivo?.startsWith(PREFIJO_MOTIVO_SIMULADO) ? 'ia_simulada' : 'ia';
}
