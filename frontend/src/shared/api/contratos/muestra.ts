import { z } from 'zod';
import { montoDecimal } from './montoDecimal';

// Contrato de la muestra de verificación (historia 9.4): `GET /muestra` y
// `POST /muestra/casos/:decisionId/verificar`. Los montos viajan como texto
// ("18560.4000") y así se quedan: ninguno pasa por `number`.

const contador = z.int().min(0);
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes AAAA-MM');

/** Lo que una persona puede marcar en un caso. */
export const resultadoMuestra = z.enum(['conforme', 'desacuerdo']);
export type ResultadoMuestra = z.infer<typeof resultadoMuestra>;

/** La marca vigente de un caso: la última, o `pendiente` si nadie marcó. */
export const marcaMuestra = z.enum(['pendiente', 'conforme', 'desacuerdo']);
export type MarcaMuestra = z.infer<typeof marcaMuestra>;

const cfdiMuestra = z.object({
  id: z.string(),
  uuidFiscal: z.string(),
  serie: z.string().nullable(),
  folio: z.string().nullable(),
  nombreEmisor: z.string().nullable(),
  nombreReceptor: z.string().nullable(),
  total: montoDecimal,
  moneda: z.string(),
});
export type CfdiMuestra = z.infer<typeof cfdiMuestra>;

const marcaDeCaso = z.object({
  quien: z.string(),
  resultado: resultadoMuestra,
  /** Instante ISO 8601. */
  cuando: z.string(),
});
export type MarcaDeCaso = z.infer<typeof marcaDeCaso>;

const casoMuestra = z.object({
  decisionId: z.string(),
  movimientoId: z.string(),
  /** AAAA-MM-DD. */
  fecha: z.string(),
  descripcion: z.string(),
  referencia: z.string().nullable(),
  monto: montoDecimal,
  moneda: z.string(),
  banco: z.string().nullable(),
  regla: z.string().nullable(),
  /** Por qué el motor lo propuso, tal como se guardó. */
  motivo: z.string().nullable(),
  cfdis: z.array(cfdiMuestra),
  confirmadaPor: z.string().nullable(),
  /** Quien consulta es quien confirmó el lote (lo decide el servidor, no el nombre). */
  confirmadaPorMi: z.boolean(),
  confirmadaAt: z.string().nullable(),
  marca: marcaMuestra,
  marcadaPor: z.string().nullable(),
  marcadaAt: z.string().nullable(),
  /** Todas las marcas, la más reciente primero. */
  marcas: z.array(marcaDeCaso),
  /** La decisión ya no está confirmada: se muestra, pero no se marca. */
  reabierta: z.boolean(),
  /** Lo que el servidor permite a quien consulta; el botón solo lo refleja. */
  puedeMarcar: z.boolean(),
});
export type CasoMuestra = z.infer<typeof casoMuestra>;

export const respuestaMuestra = z.object({
  /** `null` si no hay ninguna muestra. */
  mes: mes.nullable(),
  /** Meses con muestra, el más reciente primero. */
  meses: z.array(mes),
  /** La empresa no tiene a nadie con el rol revisor. */
  sinRevisor: z.boolean(),
  /** Quien consulta está entre quienes pueden verificar. */
  puedeVerificar: z.boolean(),
  avance: z.object({
    total: contador,
    conformes: contador,
    desacuerdos: contador,
    /** No cuenta las reabiertas. */
    pendientes: contador,
    reabiertas: contador,
  }),
  casos: z.array(casoMuestra),
});
export type RespuestaMuestra = z.infer<typeof respuestaMuestra>;

export const respuestaMarca = z.object({
  decisionId: z.string(),
  marca: resultadoMuestra,
  marcadaPor: z.string(),
  marcadaAt: z.string(),
});
export type RespuestaMarca = z.infer<typeof respuestaMarca>;
