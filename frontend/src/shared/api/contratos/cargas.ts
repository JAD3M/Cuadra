import { z } from 'zod';
import {
  ESTADOS_CARGA,
  RESULTADO_ERROR,
  TIPOS_CARGA,
  type ResultadoArchivo,
} from '@/shared/dominio';
import { montoDecimal } from './montoDecimal';

// Contratos de las cargas (CU-24): `GET /cargas`, `GET /cargas/:id`, la
// respuesta de `POST /cargas/cfdi|estado-cuenta`, la lectura de un PDF
// (`POST /cargas/estado-cuenta/pdf`) y `GET /bancos/perfiles`.
// Validan SOLO lo que la pantalla usa e ignoran claves desconocidas, como los
// de la bandeja y el caso. Tipo y estado salen del espejo del dominio: un
// literal desconocido es un `ContratoError`. Los contadores son enteros JSON,
// nunca cadenas. El único dinero son los dos saldos de la lectura de un PDF:
// cadenas decimales (`montoDecimal`), nunca números.

const texto = z.string().min(1);
const contador = z.int().min(0);

/** Una carga del historial: las claves que pinta la tabla. */
export const itemCarga = z.object({
  id: z.guid(),
  tipo: z.enum(TIPOS_CARGA),
  nombreArchivo: texto,
  estado: z.enum(ESTADOS_CARGA),
  registrosOk: contador,
  registrosError: contador,
  /** `null` cuando quien subió la carga ya no existe. */
  subidoPor: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /**
   * Archivos del lote marcados «moneda no soportada» (historia 3.1). Una
   * respuesta que no lo trae se lee como 0: no hay nota.
   */
  monedaNoSoportada: contador.default(0),
});

export const respuestaListaCargas = z.object({
  datos: z.array(itemCarga),
});

/**
 * Qué pasó con cada archivo (CFDI) o cada fila que no entró (estado de
 * cuenta). El `motivo` solo viene con `error`; `fila` es la línea física del
 * archivo (el encabezado es la 1). Los literales de `resultado` son del
 * espejo (`RESULTADOS_ARCHIVO`).
 */
const archivoSinError = z.object({
  archivo: texto,
  resultado: z.enum([
    'nuevo',
    'ya_existia',
  ] as const satisfies readonly ResultadoArchivo[]),
  /**
   * Solo en un CFDI cuya moneda no es MXN ni XXX (historia 3.1): el código de
   * tres letras y la marca. El archivo se guardó; Cuadra no lo concilia.
   */
  moneda: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  monedaNoSoportada: z.boolean().optional(),
});
const archivoConError = z.object({
  archivo: texto,
  resultado: z.literal(RESULTADO_ERROR),
  motivo: z.string(),
});
const filaConError = z.object({
  fila: z.int().min(1),
  resultado: z.literal(RESULTADO_ERROR),
  motivo: z.string(),
});

export const resultadoDeCarga = z.union([
  archivoSinError,
  archivoConError,
  filaConError,
]);

/** `GET /cargas/:id`. */
export const detalleCarga = z.object({
  id: z.guid(),
  estado: z.enum(ESTADOS_CARGA),
  totalRegistros: contador,
  registrosOk: contador,
  registrosExistentes: contador,
  registrosError: contador,
  resultados: z.array(resultadoDeCarga),
  /** Solo en `fallida`: un mensaje genérico del servidor. */
  errorMensaje: z.string().nullable(),
});

/** El POST responde el detalle y además dice si el lote ya se había cargado. */
export const respuestaCarga = detalleCarga.extend({ yaExistia: z.boolean() });

/**
 * `POST /cargas/estado-cuenta/pdf` (historias 3.2 y 3.3): lo que se leyó del
 * PDF y la carga que quedó guardada en `pendiente_vista_previa` (o la que ya
 * existía). Los saldos se quedan como cadenas.
 */
export const respuestaLecturaPdf = z.object({
  banco: texto,
  saldoInicial: montoDecimal,
  saldoFinal: montoDecimal,
  movimientosLeidos: contador,
  lineasNoLeidas: contador,
  cargaId: z.guid(),
  estado: z.enum(ESTADOS_CARGA),
  yaExistia: z.boolean(),
});

/** Una línea del PDF que el lector no pudo leer (cuerpo del 400, historia 3.3). */
export const lineaNoLeida = z.object({
  linea: z.int().min(1),
  texto: z.string(),
});

/** Campos extra del 400 `saldos_no_cuadran`: los montos son cadenas decimales. */
export const cuerpoSaldosNoCuadran = z.object({
  /** El saldo final que traía el PDF; el servidor aún no lo manda (opcional). */
  saldoFinal: montoDecimal.optional(),
  saldoEsperado: montoDecimal,
  diferencia: montoDecimal,
  lineasNoLeidas: z.array(lineaNoLeida),
});

/** Campos extra del 400 `lineas_no_leidas`. */
export const cuerpoLineasNoLeidas = z.object({
  lineasNoLeidas: z.array(lineaNoLeida),
});

/** `GET /bancos/perfiles`: un arreglo sin envoltorio. */
export const perfilesBancarios = z.array(
  z.object({ id: texto, nombre: texto }),
);

export type ItemCarga = z.infer<typeof itemCarga>;
export type RespuestaListaCargas = z.infer<typeof respuestaListaCargas>;
export type ResultadoDeCarga = z.infer<typeof resultadoDeCarga>;
export type ResultadoArchivoSinError = z.infer<typeof archivoSinError>;
export type DetalleCarga = z.infer<typeof detalleCarga>;
export type RespuestaCarga = z.infer<typeof respuestaCarga>;
export type RespuestaLecturaPdf = z.infer<typeof respuestaLecturaPdf>;
export type LineaNoLeida = z.infer<typeof lineaNoLeida>;
export type PerfilBancario = z.infer<typeof perfilesBancarios>[number];
