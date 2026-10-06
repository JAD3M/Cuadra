/**
 * Todo el texto de Cargas vive aquí, en un solo lugar (Cargas.dc.html v23).
 * Los componentes importan estas constantes en vez de escribir texto propio.
 * El texto de conectividad y de permiso es el de la bandeja (M10), no el de
 * `mensajes.ts`.
 */

export {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/bandeja/textos';

export const TITULO_DOCUMENTO = 'Cargas · Cuadra';

/** Valor de una celda que no aplica o aún no existe. */
export const SIN_DATO = '—';

/** Historial de cargas recientes. */
export const HISTORIAL = {
  titulo: 'Cargas recientes',
  /** Nombre accesible de la región de la tabla. */
  nombreTabla: 'Historial de cargas',
} as const;

export const CARGANDO_CARGAS = 'Cargando cargas';

export const VACIO_CARGAS = {
  titulo: 'Aún no hay cargas.',
  detalle: 'Sube un CFDI o un estado de cuenta para empezar.',
} as const;

/** Encabezados de la tabla, en el orden de K2. */
export const COLUMNAS_CARGAS = {
  tipo: 'Tipo',
  archivo: 'Archivo',
  estado: 'Estado',
  avance: 'Avance',
  validos: 'Válidos',
  conError: 'Con error',
  subio: 'Subió',
  fecha: 'Fecha',
} as const;

/** Nombre accesible de la barra de avance: «Avance: Procesando». */
export const nombreDeAvance = (etiquetaEstado: string): string =>
  `Avance: ${etiquetaEstado}`;
