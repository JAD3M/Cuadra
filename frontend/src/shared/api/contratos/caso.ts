import { z } from 'zod';
import { ORIGENES_CONCILIACION } from '@/shared/dominio/tipos';
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
});

export const propuestaCaso = z.object({
  conciliacionId: z.guid(),
  /** Las rechazadas nunca llegan: el backend no las devuelve. */
  estado: z.enum(['propuesta', 'confirmada']),
  origen: z.enum(ORIGENES_CONCILIACION),
  score: z.string().nullable(),
  regla,
  motivo: z.string().nullable(),
  diferenciaMonto: montoDecimal.nullable(),
  confirmadaAt: z.iso.datetime().nullable(),
  confirmadaPor: z.object({ nombre: texto }).nullable(),
  cfdi: cfdiCaso,
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
    propuestas: z.array(propuestaCaso),
  })
  .superRefine((caso, ctx) => {
    const { estado, propuestas } = caso;
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
  estado: z.enum(['confirmada', 'rechazada']),
  cfdiId: z.guid(),
  movimientoId: z.guid(),
  motivo: z.string().nullable(),
  confirmadaAt: z.iso.datetime().nullable(),
  rechazadasAutomaticamente: z.array(z.guid()),
});

/**
 * Historial de una conciliación. `datos` (el JSON crudo del evento), el
 * correo y la IP no se validan ni se exponen. Una acción desconocida pasa como
 * texto y se muestra tal cual.
 */
export const respuestaHistorial = z.object({
  datos: z.array(
    z.object({
      id: texto,
      accion: z.string(),
      createdAt: z.iso.datetime(),
      usuario: z.object({ nombre: texto }).nullable(),
    }),
  ),
});

export type CfdiCaso = z.infer<typeof cfdiCaso>;
export type PropuestaCaso = z.infer<typeof propuestaCaso>;
export type RespuestaCaso = z.infer<typeof respuestaCaso>;
export type RespuestaResolucion = z.infer<typeof respuestaResolucion>;
export type RespuestaHistorial = z.infer<typeof respuestaHistorial>;
