// src/sugerencias/validar-sugerencia.ts
import { z } from 'zod';
import { compatibles } from '../conciliacion/evaluar-par';
import { CONFIANZAS, type Confianza } from './proveedor-sugerencia';
import type { SolicitudSugerencia } from './candidatos';

/**
 * CU-17. La decisión de aceptar una respuesta del modelo es determinista y
 * vive aquí, no en el modelo: la etiqueta tiene que estar en el conjunto que
 * se le mostró, la confianza tiene que alcanzar el mínimo y moneda y fecha se
 * revisan otra vez contra el CFDI elegido. Lo demás es "sin sugerencia".
 */

/** Se aceptan 'alta' y 'media'; 'baja' se descarta. Decisión de producto revisable. */
export const MIN_CONFIANZA: Confianza = 'media';

/** Largo máximo del motivo guardado, prefijo incluido. */
export const MAX_MOTIVO = 500;
export const PREFIJO_MOTIVO = 'Sugerencia de IA: ';

const RANGO: Record<Confianza, number> = { baja: 0, media: 1, alta: 2 };

/**
 * Forma de lo que devuelve un proveedor. Una respuesta que no cumpla esto es un
 * contrato roto del proveedor, no un "no sé" del modelo. Los campos de más en
 * 'ninguno' (candidato null, confianza, explicación) se ignoran.
 */
export const esquemaRespuesta = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('sugerir'),
    candidato: z.string().min(1),
    confianza: z.enum(CONFIANZAS),
    explicacion: z.string(),
  }),
  z.object({ decision: z.literal('ninguno') }),
  z.object({ decision: z.literal('sin_respuesta') }),
]);

export type MotivoSinSugerencia =
  | 'ninguno'
  | 'sin_respuesta'
  | 'etiqueta_desconocida'
  | 'confianza_baja'
  | 'no_compatible';

export type Decision =
  | { tipo: 'sugerir'; cfdiId: string; confianza: Confianza; motivo: string }
  | { tipo: 'sin_sugerencia'; motivo: MotivoSinSugerencia }
  | { tipo: 'error'; detalle: string };

/**
 * El texto del modelo termina en una columna y en pantalla: se quitan los
 * caracteres de control, se colapsa el espacio y se recorta (por puntos de
 * código, para no partir un par sustituto).
 */
export function motivoDeSugerencia(explicacion: string): string {
  const limpia = explicacion
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const completo = `${PREFIJO_MOTIVO}${limpia || 'sin explicación'}`;
  return Array.from(completo).slice(0, MAX_MOTIVO).join('');
}

export function validarRespuesta(
  respuesta: unknown,
  solicitud: SolicitudSugerencia,
): Decision {
  const analisis = esquemaRespuesta.safeParse(respuesta);
  if (!analisis.success) {
    return {
      tipo: 'error',
      detalle: `Respuesta del proveedor fuera de contrato: ${analisis.error.message}`,
    };
  }
  const r = analisis.data;
  if (r.decision !== 'sugerir') {
    return { tipo: 'sin_sugerencia', motivo: r.decision };
  }

  const elegido = solicitud.candidatos.find((c) => c.etiqueta === r.candidato);
  if (!elegido) {
    return { tipo: 'sin_sugerencia', motivo: 'etiqueta_desconocida' };
  }
  if (RANGO[r.confianza] < RANGO[MIN_CONFIANZA]) {
    return { tipo: 'sin_sugerencia', motivo: 'confianza_baja' };
  }
  if (!compatibles(solicitud.movimiento, elegido.cfdi)) {
    return { tipo: 'sin_sugerencia', motivo: 'no_compatible' };
  }
  return {
    tipo: 'sugerir',
    cfdiId: elegido.cfdi.id,
    confianza: r.confianza,
    motivo: motivoDeSugerencia(r.explicacion),
  };
}
