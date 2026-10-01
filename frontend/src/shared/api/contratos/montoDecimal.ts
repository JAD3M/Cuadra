import { z } from 'zod';
import { PATRON_DECIMAL } from '@/shared/dinero';

/**
 * Monto tal como lo envía la API: cadena decimal (`NUMERIC` en la base), nunca
 * un número JSON. Aceptar un número aquí ya habría perdido precisión al
 * parsear el JSON. Rechaza `''`, notación científica, `NaN` y separadores de
 * miles; el valor se conserva intacto como texto.
 */
export const montoDecimal = z
  .string()
  .regex(
    PATRON_DECIMAL,
    'El monto debe ser una cadena decimal (por ejemplo "1234.50")',
  );

export type MontoDecimal = z.infer<typeof montoDecimal>;
