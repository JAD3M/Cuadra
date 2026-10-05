import type { TipoMensaje } from '@/shared/api/mensajes';

/**
 * Todo el texto de la bandeja vive aquí, en un solo lugar. Los textos del
 * estado de los KPI, de los estados vacíos y de error están pendientes del
 * visto bueno final del usuario (R3): cambiarlos es editar solo este archivo.
 * Los componentes importan estas constantes en vez de escribir texto propio.
 */

export const TITULO = 'Bandeja de revisión';
export const SUBTITULO = 'Movimientos abiertos, del monto más alto al más bajo';
export const TITULO_DOCUMENTO = 'Bandeja de revisión · Cuadra';
export const ORDEN = 'Orden: monto ↓';
export const NOMBRE_TABLA = 'Movimientos por revisar';

/** Texto de los filtros de estado. */
export const GRUPO_FILTROS = 'Filtrar por estado';
export const AVISO_ULTIMO_FILTRO = 'Debe quedar al menos un estado activo.';

/** Indicadores resumen. */
export const KPI = {
  sugerencia: {
    etiqueta: 'Sugerencias',
    detalle: 'esperan que confirmes o rechaces',
  },
  sin_match: {
    etiqueta: 'Sin match',
    detalle: 'el motor no encontró un CFDI seguro',
  },
  conciliado: {
    etiqueta: 'Conciliados',
    detalle: 'confirmados por una persona',
  },
} as const;
export const KPI_MONTO = 'Monto por revisar';
export const KPI_MONTO_UNA_MONEDA = 'MXN en sugerencias y sin match';
export const KPI_MONTO_VARIAS_MONEDAS = 'En sugerencias y sin match';
export const KPI_NO_DISPONIBLE = '—';
export const KPI_NO_DISPONIBLE_OCULTO = 'No disponible';
export const REINTENTAR = 'Reintentar';

/** Estados de la lista. */
export const CARGANDO = 'Cargando movimientos';
export const VACIO_CON_FILTROS = {
  titulo: 'No hay movimientos con estos filtros.',
  detalle: 'Prueba con otros estados.',
  accion: 'Restablecer filtros',
} as const;
export const VACIO_POR_DEFECTO = {
  titulo: 'No hay movimientos por revisar.',
  detalle: 'Todo lo abierto ya tiene una decisión.',
} as const;
export const ERROR_CONEXION = {
  titulo: 'No se pudo conectar con el servidor.',
  detalle: 'Revisa tu conexión e inténtalo de nuevo.',
} as const;
export const ERROR_SIN_PERMISO = {
  titulo: 'No tienes permiso para esta acción.',
  detalle:
    'Si crees que es un error, pide acceso a un administrador de la empresa.',
} as const;

/**
 * Línea de apoyo del error de la lista, por el tipo que clasifica
 * `mensajeDeError`. El título sigue saliendo de `mensajeDeError`; los tipos
 * sin línea aquí no muestran detalle.
 */
export const detallePorTipo: Partial<Record<TipoMensaje, string>> = {
  conexion: ERROR_CONEXION.detalle,
  sin_permiso: ERROR_SIN_PERMISO.detalle,
};

/** Paginación. */
export const PAGINACION = {
  nombre: 'Paginación',
  anterior: 'Página anterior',
  siguiente: 'Página siguiente',
  mostrando: 'Mostrando',
  sinResultados: 'Sin resultados',
} as const;

/** Celdas de la tabla. */
export const COLUMNAS = {
  fecha: 'Fecha',
  movimiento: 'Movimiento',
  monto: 'Monto',
  estado: 'Estado',
  regla: 'Regla / motivo',
  cfdi: 'CFDI candidato',
  diferencia: 'Diferencia',
} as const;
export const SIN_REFERENCIA = 'sin referencia';
export const PREFIJO_REFERENCIA = 'REF';
export const SIN_DATO = '—';
export const MENOR_A_UN_CENTAVO = 'menor a un centavo';
/** Insignia de IA: el glifo es decorativo y el texto lleva el significado. */
export const INSIGNIA_GLIFO = '✦';
export const INSIGNIA_IA = 'IA';
export const INSIGNIA_IA_SIMULADA = 'IA · simulada';
