import { z } from 'zod';
import { ESTADOS_BANDEJA, LIMITE_MAXIMO } from '@/shared/dominio/bandeja';
import { MOTIVOS_BLOQUEO, MOTIVOS_REVISION } from '@/shared/dominio/tipos';
import { ESTADOS_CFDI } from '@/shared/dominio/tipos';
import { montoDecimal } from './montoDecimal';

// Contratos de `GET /bandeja` y `GET /bandeja/resumen` (CU-22). Se derivan de
// src/bandeja/dto/bandeja.dto.ts, pero validan SOLO lo que la pantalla usa: un
// campo que nadie lee no debe poder romper toda la bandeja con un
// `ContratoError`. Los campos que se omiten a propósito (score, nombreEmisor,
// rfcReceptor, nombreReceptor, fechaEmision y metodoPago del CFDI, y el
// `score`, `regla` y `motivo` de la mejor propuesta) quedan para el detalle del
// caso. Los objetos ignoran claves desconocidas, como los de auth. Todo monto
// pasa por `montoDecimal` (cadena, nunca número) y los conteos son enteros.

const texto = z.string().min(1);
const moneda = z.string().length(3);

/** Estado validado contra el espejo: uno desconocido falla en la frontera. */
export const estadoBandeja = z.enum(ESTADOS_BANDEJA);

/** CFDI candidato. `uuidFiscal` solo identifica: no se valida su formato. */
export const cfdiResumen = z.object({
  id: z.guid(),
  uuidFiscal: texto,
  serie: z.string().nullable(),
  folio: z.string().nullable(),
  total: montoDecimal,
  moneda,
  /** De ESTA factura: en un grupo, la cancelada puede no ser la primera. */
  estado: z.enum(ESTADOS_CFDI),
});

export const mejorPropuesta = z.object({
  conciliacionId: z.guid(),
  diferenciaMonto: montoDecimal.nullable(),
  /** Primera factura (id ascendente); en un grupo ver `cfdis`. */
  cfdi: cfdiResumen,
  /** Todas las facturas de la propuesta (un grupo tiene varias). */
  cfdis: z.array(cfdiResumen).optional(),
});

/** `movimientoId` como guid también hace seguro armar `/casos/${id}`. */
export const filaBandeja = z.object({
  movimientoId: z.guid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monto: montoDecimal,
  descripcion: z.string(),
  referencia: z.string().nullable(),
  moneda,
  estado: estadoBandeja,
  propuestasCount: z.int().min(0),
  /** Confirmada cuya factura se canceló después; el servidor la sigue contando conciliada. */
  requiereRevision: z.boolean(),
  /** Código estable; solo viene con `requiereRevision` y una factura cancelada. */
  motivoRevision: z.enum(MOTIVOS_REVISION).nullable(),
  /** Por qué ESTA persona no puede confirmar la propuesta (separación de funciones). */
  motivoBloqueo: z.enum(MOTIVOS_BLOQUEO).nullable(),
  motivo: z.string().nullable(),
  regla: z.string().nullable(),
  mejorPropuesta: mejorPropuesta.nullable(),
});

/** `GET /bandeja`. */
export const respuestaBandeja = z.object({
  datos: z.array(filaBandeja),
  pagina: z.int().min(1),
  limite: z.int().min(1).max(LIMITE_MAXIMO),
  total: z.int().min(0),
});

/**
 * `GET /bandeja/resumen`. `z.record` con un enum es exhaustivo: si el backend
 * agrega un estado, el contrato (y los tipos) fallan hasta espejarlo.
 */
export const resumenBandeja = z.object({
  conteos: z.record(estadoBandeja, z.int().min(0)),
  montoPorRevisar: z.array(z.object({ moneda, monto: montoDecimal })),
  /**
   * Conciliadas marcadas «requiere revisión» (5.1). Ya cuentan en
   * `conteos.conciliado`; este número solo avisa cuántas piden mirarse.
   */
  requiereRevision: z.int().min(0),
});

export type FilaBandeja = z.infer<typeof filaBandeja>;
export type RespuestaBandeja = z.infer<typeof respuestaBandeja>;
export type ResumenBandeja = z.infer<typeof resumenBandeja>;
