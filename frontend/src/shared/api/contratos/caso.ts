import { z } from 'zod';
import {
  ESTADOS_CFDI,
  NIVELES_CONFIANZA,
  ORIGENES_CONCILIACION,
  type EstadoConciliacion,
  type EstadoDecision,
} from '@/shared/dominio/tipos';
import { estadoBandeja } from './bandeja';
import { montoDecimal } from './montoDecimal';

// Contratos del detalle del caso (CU-23): `GET /casos/:movimientoId`, la
// respuesta de `POST /conciliaciones/:id/confirmar|rechazar` y
// `GET /conciliaciones/:id/historial`. Validan SOLO lo que la pantalla usa y
// ignoran claves desconocidas, como los de la bandeja. Todo monto pasa por
// `montoDecimal` (cadena, nunca número). `score` es un decimal que solo se
// muestra: no es dinero y nunca se compara en el cliente.

const texto = z.string().min(1);
const moneda = z.string().length(3);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Un código de regla desconocido pasa tal cual: se muestra verbatim. */
const regla = z.string().nullable();

export const cfdiCaso = z.object({
  id: z.guid(),
  uuidFiscal: texto,
  serie: z.string().nullable(),
  folio: z.string().nullable(),
  nombreEmisor: z.string().nullable(),
  rfcReceptor: texto,
  nombreReceptor: z.string().nullable(),
  fechaEmision: dia,
  total: montoDecimal,
  moneda,
  metodoPago: z.string().nullable(),
  /** De ESTA factura: en un grupo, la cancelada puede no ser la primera. */
  estado: z.enum(ESTADOS_CFDI),
});

export const propuestaCaso = z.object({
  conciliacionId: z.guid(),
  /** Las rechazadas nunca llegan: el backend no las devuelve. */
  estado: z.enum([
    'propuesta',
    'confirmada',
  ] as const satisfies readonly EstadoConciliacion[]),
  origen: z.enum(ORIGENES_CONCILIACION),
  score: z.string().nullable(),
  regla,
  /** Nivel derivado del score; solo lo trae el motor de reglas. */
  confianza: z.enum(NIVELES_CONFIANZA).nullable().optional(),
  motivo: z.string().nullable(),
  diferenciaMonto: montoDecimal.nullable(),
  confirmadaAt: z.iso.datetime().nullable(),
  confirmadaPor: z.object({ nombre: texto }).nullable(),
  /** Confirmada cuya factura se canceló después. */
  requiereRevision: z.boolean(),
  /** Primera factura (id ascendente); en un grupo ver `cfdis`. */
  cfdi: cfdiCaso,
  /** Todas las facturas de la propuesta (un grupo tiene varias). */
  cfdis: z.array(cfdiCaso).optional(),
});

/**
 * El descarte vigente de un movimiento (5.6). `puedeDeshacer` lo decide el
 * servidor (admin o quien descartó): el cliente no lo deduce del rol.
 */
export const descarteCaso = z.object({
  motivo: texto,
  por: z.string().nullable(),
  /** Instante ISO del descarte. */
  fecha: z.iso.datetime().nullable(),
  puedeDeshacer: z.boolean(),
});

/**
 * Un comentario sobre una decisión del caso (5.9). Solo se agrega: no se edita
 * ni se borra. `por` es el nombre de quien comentó; `fecha`, un instante ISO.
 */
export const comentarioCaso = z.object({
  id: z.guid(),
  decisionId: z.guid(),
  texto,
  por: z.string(),
  fecha: z.iso.datetime(),
});

/**
 * La coherencia entre el estado derivado y las propuestas protege la regla de
 * que el cliente no decide: una respuesta incoherente es un `ContratoError`.
 */
export const respuestaCaso = z
  .object({
    movimiento: z.object({
      id: z.guid(),
      fecha: dia,
      monto: montoDecimal,
      moneda,
      descripcion: z.string(),
      referencia: z.string().nullable(),
    }),
    estado: estadoBandeja,
    sinMatch: z.object({ regla, motivo: z.string().nullable() }).nullable(),
    toleranciaMonto: montoDecimal,
    /** Alguna decisión del caso quedó por revisar; el caso sigue conciliado. */
    requiereRevision: z.boolean(),
    propuestas: z.array(propuestaCaso),
    /** Solo un movimiento descartado lo trae; las respuestas viejas no. */
    descarte: descarteCaso.nullable().optional(),
    /**
     * Lo decide el servidor (5.7): conciliado y quien mira es admin o quien
     * confirmó, con el permiso. Las respuestas viejas no lo traen: false.
     */
    puedeReabrir: z.boolean().default(false),
    /** Comentarios de las decisiones del caso, del más antiguo al más reciente (5.9). */
    comentarios: z.array(comentarioCaso),
    /** Lo decide el servidor (5.9): rol con el permiso y el caso con propuestas. */
    puedeComentar: z.boolean(),
  })
  .superRefine((caso, ctx) => {
    const { estado, propuestas } = caso;
    if (caso.descarte && (estado !== 'sin_match' || propuestas.length > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['descarte'],
        message: 'Un movimiento descartado no tiene propuestas',
      });
    }
    const todas = (e: string) => propuestas.every((p) => p.estado === e);
    const coherente =
      (estado === 'conciliado' &&
        propuestas.length === 1 &&
        todas('confirmada')) ||
      (estado === 'sugerencia' &&
        propuestas.length >= 1 &&
        todas('propuesta')) ||
      (estado === 'sin_match' && propuestas.length === 0);
    if (!coherente) {
      ctx.addIssue({
        code: 'custom',
        path: ['propuestas'],
        message: `Las propuestas no corresponden al estado "${estado}"`,
      });
    }
  });

/** `rechazadasAutomaticamente` se lee solo por su largo. */
export const respuestaResolucion = z.object({
  id: z.guid(),
  estado: z.enum([
    'confirmada',
    'rechazada',
  ] as const satisfies readonly EstadoConciliacion[]),
  cfdiId: z.guid(),
  /** Todas las facturas de la decisión (un grupo tiene varias). */
  cfdiIds: z.array(z.guid()).optional(),
  movimientoId: z.guid(),
  motivo: z.string().nullable(),
  confirmadaAt: z.iso.datetime().nullable(),
  rechazadasAutomaticamente: z.array(z.guid()),
});

/** `POST /movimientos/:id/descartar` y `/deshacer-descarte`. */
export const respuestaDescarte = z.object({
  id: z.guid(),
  movimientoId: z.guid(),
  estado: z.enum([
    'descartada',
    'reabierta',
  ] as const satisfies readonly EstadoDecision[]),
  motivo: z.string().nullable(),
});

/** `POST /conciliaciones/:id/reabrir`: la confirmación pasa a `reabierta`. */
export const respuestaReabrir = z.object({
  id: z.guid(),
  estado: z.literal('reabierta' satisfies EstadoDecision),
  movimientoId: z.guid(),
  cfdiIds: z.array(z.guid()),
  motivo: z.string(),
});

/** `POST /conciliaciones/:id/comentarios`: el comentario guardado. */
export const respuestaComentario = comentarioCaso;

/** Motivo del evento si `datos` lo trae como texto; cualquier otra forma, nada. */
function motivoDeDatos(datos: unknown): string | undefined {
  if (datos === null || typeof datos !== 'object') return undefined;
  const motivo = (datos as { motivo?: unknown }).motivo;
  return typeof motivo === 'string' ? motivo : undefined;
}

/** Texto del evento `comentar` si `datos` lo trae como cadena; otra forma, nada. */
function textoDeDatos(datos: unknown): string | undefined {
  if (datos === null || typeof datos !== 'object') return undefined;
  const valor = (datos as { texto?: unknown }).texto;
  return typeof valor === 'string' ? valor : undefined;
}

/**
 * Historial de una conciliación. De `datos` (el JSON crudo del evento) solo se
 * exponen el `motivo` (la reapertura lo trae, 5.7) y el `texto` (el comentario,
 * 5.9); el resto, el correo y la IP
 * no se validan ni se exponen. Una acción desconocida pasa como texto y se
 * muestra tal cual.
 */
export const respuestaHistorial = z.object({
  datos: z.array(
    z
      .object({
        id: texto,
        accion: z.string(),
        /** Dónde se escribió el evento; `cfdi` es la cancelación de una factura (4.6). */
        entidad: z.string().optional(),
        entidadId: z.string().optional(),
        createdAt: z.iso.datetime(),
        usuario: z.object({ nombre: texto }).nullable(),
        datos: z.unknown().optional(),
      })
      .transform(
        ({
          datos,
          ...evento
        }): typeof evento & { motivo?: string; texto?: string } => {
          const motivo = motivoDeDatos(datos);
          const comentario = textoDeDatos(datos);
          return {
            ...evento,
            ...(motivo === undefined ? {} : { motivo }),
            ...(comentario === undefined ? {} : { texto: comentario }),
          };
        },
      ),
  ),
});

export type CfdiCaso = z.infer<typeof cfdiCaso>;
export type PropuestaCaso = z.infer<typeof propuestaCaso>;
export type RespuestaCaso = z.infer<typeof respuestaCaso>;
export type RespuestaResolucion = z.infer<typeof respuestaResolucion>;
export type DescarteCaso = z.infer<typeof descarteCaso>;
export type RespuestaDescarte = z.infer<typeof respuestaDescarte>;
export type ComentarioCaso = z.infer<typeof comentarioCaso>;
export type RespuestaComentario = z.infer<typeof respuestaComentario>;
export type RespuestaReabrir = z.infer<typeof respuestaReabrir>;
export type RespuestaHistorial = z.infer<typeof respuestaHistorial>;
