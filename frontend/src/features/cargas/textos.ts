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
import type { ResultadoArchivo } from '@/shared/dominio';
import type { MotivoRechazo } from './seleccion';

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

/** Por qué un archivo local no se sube (M4). Va en la fila del archivo. */
export const RECHAZO_CFDI = {
  extension: 'Solo se aceptan archivos .xml',
  tamano: 'El archivo pasa de 2 MB',
  cantidad: 'Son más de 500 archivos. Divide la carga en partes más pequeñas.',
  total: 'La selección pasa de 50 MB. Divide la carga en partes más pequeñas.',
} as const satisfies Record<MotivoRechazo, string>;

export const RECHAZO_ESTADO_CUENTA = {
  extension: 'Solo se aceptan archivos .csv',
  tamano: 'El archivo pasa de 10 MB',
  // El estado de cuenta es un solo archivo: nunca hay tope de cantidad ni de
  // total. El registro es exhaustivo para que el tipo no tenga huecos y reusa
  // el texto de tamaño en vez de inventar copy que no existe en el mockup.
  cantidad: 'El archivo pasa de 10 MB',
  total: 'El archivo pasa de 10 MB',
} as const satisfies Record<MotivoRechazo, string>;

export const ARCHIVO_LISTO = 'Listo para subir';
export const QUITAR_RECHAZADOS = 'Quitar rechazados';
export const ELEGIR_ARCHIVOS = 'Elegir archivos';
export const ELEGIR_ARCHIVO = 'Elegir archivo';
export const SUBIENDO = 'Subiendo…';
export const SUBIENDO_ARCHIVOS = 'Subiendo tus archivos';

/** Aviso de solo lectura: el rol no sube cargas. */
export const AVISO_REVISOR = {
  titulo: 'Tu rol solo permite consultar las cargas.',
  detalle: 'Pide a un administrador o contador que suba los archivos.',
} as const;

/** Tarjeta de CFDI (mockup: «CFDI · XML»). */
export const TARJETA_CFDI = {
  titulo: 'CFDI · XML',
  zona: 'Arrastra tus XML aquí',
  zonaDetalle:
    'Cada archivo se valida por separado. Un XML inválido no detiene a los demás.',
  limites:
    'Solo .xml · hasta 2 MB por archivo · máximo 500 archivos y 50 MB por carga',
  lista: 'Archivos elegidos',
} as const;

/** «2 archivos listos.», «1 archivo listo.» o «2 de 4 listos…» (mockup v23). */
export function resumenDeSeleccion(listos: number, total: number): string {
  if (listos < total) {
    return `${listos} de ${total} listos. Los rechazados no se suben.`;
  }
  return listos === 1 ? '1 archivo listo.' : `${listos} archivos listos.`;
}

/** Botón de subida de CFDI: «Subir 1 archivo» en singular (M14). */
export function botonSubirCfdi(listos: number): string {
  if (listos === 0) return 'Subir archivos';
  return listos === 1 ? 'Subir 1 archivo' : `Subir ${listos} archivos`;
}

/** Tarjeta de estado de cuenta. */
export const TARJETA_ESTADO_CUENTA = {
  titulo: 'Estado de cuenta',
  banco: 'Banco',
  cuenta: 'Cuenta',
  perfil: 'Perfil de lectura',
  marcaCuenta: '****1234',
  archivo: 'Archivo elegido',
  limites: 'Solo .csv · un archivo · hasta 10 MB',
  subir: 'Subir estado de cuenta',
  nota: 'El servidor vuelve a validar cada archivo: extensión, tamaño, que sea texto y que cumpla el formato. Nada de lo que subes se ejecuta.',
} as const;

/** Falla la lectura de perfiles: el select queda apagado (mockup perfiles_error). */
export const ERROR_PERFILES = 'No se pudieron cargar los perfiles.';

/** Ayuda del campo Cuenta (K4): no promete enmascarar nada. */
export const AYUDA_CUENTA =
  'Escribe solo los últimos dígitos. No hace falta el número completo.';
export const AVISO_CUENTA_COMPLETA =
  'Parece un número de cuenta completo. Escribe solo los últimos dígitos.';

/** Resultado de una carga recién subida (mockup v23: resultado_cfdi, resultado_csv, procesando_resultado, resultado_fallida, ya_existia). */
export const PROCESANDO_CARGA = 'Procesando la carga…';

/** Falla de la carga: el aviso fijo del mockup; el mensaje del servidor va aparte. */
export const CARGA_FALLIDA =
  'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.';

/** Resumen de un CFDI: «{ok} nuevos, {existentes} ya existían, {error} con error.» (cifras aparte). */
export const RESUMEN_CFDI = {
  nuevos: 'nuevos,',
  existentes: 'ya existían,',
  conError: 'con error.',
} as const;

/** Resumen de un estado de cuenta: «{ok} registros cargados, {error} con error.» */
export const RESUMEN_ESTADO_CUENTA = {
  registros: 'registros cargados,',
  conError: 'con error.',
} as const;

/** Nombres accesibles de las listas del resultado. */
export const LISTA_RESULTADO_ARCHIVOS = 'Resultado por archivo';
export const LISTA_FILAS_CON_ERROR = 'Filas con error';

/** Estado de cada archivo en el resultado de un CFDI (texto, nunca solo color). */
export const ESTADO_DE_ARCHIVO = {
  nuevo: 'Nuevo',
  ya_existia: 'Ya existía',
  error: 'Con error',
} as const satisfies Record<ResultadoArchivo, string>;

/** «Fila 14: motivo». `fila` es la línea física del archivo (el encabezado es la 1). */
export const textoDeFila = (fila: number, motivo: string): string =>
  `Fila ${fila}: ${motivo}`;

/** K7: una carga que ya existía; la frase depende del estado devuelto. */
export const YA_EXISTIA_TERMINADA = [
  'Este archivo ya se había cargado.',
  'No se duplicó nada.',
] as const;
export const YA_EXISTIA_EN_COLA = [
  'Este archivo ya se había cargado y se volvió a poner en la cola.',
] as const;

/** Alertas de una subida que falla (mockup v23: error_400, error_413, error_subida, sin_permiso_subida). */
export const ERROR_RECHAZO_CARGA = 'No se pudo procesar la carga.';
export const ERROR_DEMASIADO_GRANDE = {
  titulo: 'Los archivos pesan demasiado.',
  detalle: 'Divide la carga en partes más pequeñas e inténtalo de nuevo.',
} as const;
