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

/** Línea de apoyo bajo el título de la página (Cargas.dc.html). */
export const SUBTITULO_CARGAS =
  'Sube CFDI y estados de cuenta. El motor corre al terminar cada carga.';

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

/**
 * Resumen de un estado de cuenta (historia 3.5): «{nuevos} nuevos, {existentes}
 * ya existían, {dudosos} dudosos, {error} con error.» Cada cifra va aparte para
 * que no se parta; la palabra que la sigue concuerda en singular o plural.
 */
export const RESUMEN_ESTADO_CUENTA = {
  nuevos: (n: number): string => (n === 1 ? 'nuevo,' : 'nuevos,'),
  existentes: (n: number): string => (n === 1 ? 'ya existía,' : 'ya existían,'),
  dudosos: (n: number): string => (n === 1 ? 'dudoso,' : 'dudosos,'),
  conError: 'con error.',
} as const;

/** La leyenda ámbar bajo el resumen: qué quedó pendiente y qué se omitió. */
export const LEYENDA_ESTADO_CUENTA = {
  dudosos: (n: number): string =>
    n === 1
      ? '⚠ 1 dudoso quedó pendiente de revisión: misma cuenta, fecha y monto que uno ya cargado, con otra referencia. No se concilia hasta que se revise.'
      : `⚠ ${n} dudosos quedaron pendientes de revisión: misma cuenta, fecha y monto que otros ya cargados, con otra referencia. No se concilian hasta que se revisen.`,
  existentes: (n: number): string =>
    n === 1
      ? 'El que ya existía se omitió.'
      : `Los ${n} que ya existían se omitieron.`,
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

/** Alertas de una subida que falla (mockup v25: error_400, error_413, error_subida, sin_permiso_subida, error_otro). */
export const ERROR_RECHAZO_CARGA = 'No se pudo procesar la carga.';
export const ERROR_DEMASIADO_GRANDE = {
  titulo: 'Los archivos pesan demasiado.',
  detalle: 'Divide la carga en partes más pequeñas e inténtalo de nuevo.',
} as const;
export const ERROR_OTRO = {
  titulo: 'No se pudo completar la solicitud.',
  detalle:
    'Tus archivos siguen seleccionados. Inténtalo de nuevo en unos minutos.',
} as const;

/** Aviso del polling: la leyenda mientras corre y el aviso con «Actualizar» tras el tope (K5). */
export const SE_ACTUALIZA_SOLA = 'Se actualiza sola mientras procesa';
export const LISTA_SIN_ACTUALIZAR = 'La lista dejó de actualizarse.';
export const ACTUALIZAR = 'Actualizar';

/** Estado de cuenta que no está en MXN: el texto es del frontend, por código de error. */
export const TEXTO_MONEDA_NO_MXN = {
  titulo: 'Archivo rechazado',
  detalle:
    'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.',
} as const;

/** Selector de formato de la tarjeta de estado de cuenta (mockup 2026-10-27). */
export const FORMATO_ESTADO_CUENTA = {
  grupo: 'Formato del estado de cuenta',
  csv: 'CSV',
  pdf: 'PDF BBVA',
} as const;

/** Modo PDF de la tarjeta: solo lectura, no se importa nada (historia 3.2). */
export const TARJETA_ESTADO_CUENTA_PDF = {
  limites: 'Solo .pdf · un archivo · hasta 10 MB',
  leer: 'Leer estado de cuenta',
  soloLectura: 'Solo lectura: no se importó nada.',
} as const;

export const LEYENDO = 'Leyendo…';
export const LEYENDO_ESTADO_CUENTA = 'Leyendo el estado de cuenta…';

export const RECHAZO_ESTADO_CUENTA_PDF = {
  extension: 'Solo se aceptan archivos .pdf',
  tamano: 'El archivo pasa de 10 MB',
  // Un solo archivo: no hay tope de cantidad ni de total (ver RECHAZO_ESTADO_CUENTA).
  cantidad: 'El archivo pasa de 10 MB',
  total: 'El archivo pasa de 10 MB',
} as const satisfies Record<MotivoRechazo, string>;

/** Resultado de un PDF guardado (historia 3.3): «{n} movimientos leídos. Los saldos cuadran.» */
export const RESUMEN_LECTURA_PDF = {
  movimientos: 'movimientos leídos.',
  cuadran: 'Los saldos cuadran.',
  espera: 'Los movimientos quedan en espera: todavía no entran a conciliación.',
} as const;
export const SALDO_INICIAL = 'Saldo inicial';
export const SALDO_FINAL = 'Saldo final';
/** Rechazos de un PDF que se leyó (historia 3.3): el título es del frontend; el detalle, del servidor. */
export const TITULO_PDF_SALDOS_NO_CUADRAN =
  'Archivo rechazado: los saldos no cuadran';
export const TITULO_PDF_LINEAS_NO_LEIDAS =
  'Archivo rechazado: hay líneas sin leer';
export const TITULO_PDF_SIN_MOVIMIENTOS = 'Archivo rechazado: sin movimientos';
export const SALDO_FINAL_PDF = 'Saldo final del PDF';
export const SALDO_ESPERADO = 'Saldo esperado con los movimientos';
export const DIFERENCIA = 'Diferencia';
export const LINEAS_NO_LEIDAS_TITULO = 'Líneas que no se pudieron leer';

/** PDF sin texto seleccionable: el texto es del frontend, por código de error. */
export const TEXTO_PDF_SIN_TEXTO = {
  titulo: 'No se pudo leer el PDF',
  detalle:
    'El PDF no tiene texto seleccionable (parece una imagen escaneada). Descarga el PDF desde el portal del banco.',
} as const;

/** PDF con un formato que el lector del banco no reconoce. */
export const TEXTO_PDF_ILEGIBLE = {
  titulo: 'No se pudo leer el PDF',
  detalle: 'No reconocimos el formato del estado de cuenta BBVA.',
} as const;

/** CFDI en una moneda que Cuadra no concilia (mockup 2026-10-27). */
export const LEYENDA_MONEDA_NO_SOPORTADA =
  '⚠ Se guardó, pero Cuadra no concilia monedas distintas de MXN.';

/** Enlace a la vista previa de una carga en espera (historia 3.4). */
export const REVISAR_VISTA_PREVIA = 'Revisar vista previa';
