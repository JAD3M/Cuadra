import { z } from 'zod';
import { CAMPO_TOLERANCIA, PATRON_TOLERANCIA } from '@/shared/dominio';
import { montoDecimal } from './montoDecimal';

// Contratos de la tolerancia (CU-25): `GET`/`PUT /empresa/tolerancia` y la
// proyección de `GET /bitacora` que alimenta "Cambios recientes". El monto
// viaja siempre como cadena decimal; ningún valor pasa por `number`.

/**
 * Cadena decimal con el regex exacto del servidor (sin signo, hasta 4
 * decimales). Encadena sobre `montoDecimal`: ambas reglas deben cumplirse.
 * El servidor siempre responde NUMERIC(18,4) como texto ("0.5000").
 */
export const toleranciaDecimal = montoDecimal.regex(
  PATRON_TOLERANCIA,
  'La tolerancia debe ser una cadena decimal de 0 a 4 decimales',
);

/** `GET` y `PUT /empresa/tolerancia` responden lo mismo. */
export const respuestaTolerancia = z.object({
  toleranciaMonto: toleranciaDecimal,
});

/**
 * Un evento de la bitácora que cambió la tolerancia. Solo las claves que la
 * pantalla pinta (el correo, la IP y el agente no se piden ni se muestran).
 */
export const cambioTolerancia = z.object({
  id: z.guid(),
  createdAt: z.iso.datetime(),
  /** `null` cuando el actor fue el sistema o el usuario ya no existe. */
  usuario: z.object({ nombre: z.string().min(1) }).nullable(),
  datos: z.object({
    campo: z.literal(CAMPO_TOLERANCIA),
    antes: toleranciaDecimal,
    despues: toleranciaDecimal,
  }),
});

/**
 * El sobre de `GET /bitacora` es lo único estricto: debe traer el arreglo
 * `datos`. Cada elemento se valida aparte (`extraerCambiosTolerancia`) para
 * que una fila ajena o heredada nunca rompa la lista. `pagina`, `limite` y
 * `total` se ignoran.
 */
export const respuestaBitacoraCruda = z.object({
  datos: z.array(z.unknown()),
});

export type RespuestaTolerancia = z.infer<typeof respuestaTolerancia>;
export type CambioTolerancia = z.infer<typeof cambioTolerancia>;

/** Cambios que muestra la tarjeta; el espejo vive en `features/tolerancia/constantes`. */
const MAXIMO_POR_DEFECTO = 5;

/**
 * Se queda con los eventos de tolerancia bien formados, en el orden del
 * servidor (más nuevo primero), y devuelve los `max` primeros. Lo que no
 * cumple el contrato (otro `campo`, `datos` nulo, valores con cinco
 * decimales, filas heredadas) se omite sin error.
 */
export function extraerCambiosTolerancia(
  datos: readonly unknown[],
  max: number = MAXIMO_POR_DEFECTO,
): CambioTolerancia[] {
  const cambios: CambioTolerancia[] = [];
  for (const fila of datos) {
    const resultado = cambioTolerancia.safeParse(fila);
    if (resultado.success) cambios.push(resultado.data);
  }
  return cambios.slice(0, max);
}
