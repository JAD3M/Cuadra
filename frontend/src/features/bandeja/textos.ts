import type { TipoMensaje } from '@/shared/api/mensajes';

/**
 * Todo el texto de la bandeja vive aquí, en un solo lugar. Los textos del
 * estado de los KPI, de los estados vacíos y de error están pendientes del
 * visto bueno final del usuario (R3): cambiarlos es editar solo este archivo.
 * Los componentes importan estas constantes en vez de escribir texto propio.
 */

export const TITULO = 'Bandeja de revisión';
export const SUBTITULO =
  'Movimientos abiertos, de la propuesta más segura a la más dudosa';
export const TITULO_DOCUMENTO = 'Bandeja de revisión · Cuadra';
export const ORDEN = 'Orden: confianza ↓';
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
/** Aviso de la tarjeta «Conciliados»: cuántas conciliadas piden revisión. */
export const kpiRequiereRevision = (n: number) =>
  n === 1 ? '1 requiere revisión' : `${n} requieren revisión`;
export const KPI_MONTO = 'Monto por revisar';

/** Confirmación en lote (5.3). Textos acordados en los mockups 2 y 7. */
export const LOTE = {
  abrir: 'Confirmar en lote',
  titulo: 'Confirmación en lote',
  ayuda:
    'Solo la regla 1 viene marcada. Desmarca lo que no te convenza. El lote no pide motivo.',
  cancelar: 'Cancelar',
  confirmando: 'Confirmando…',
  columna: 'Incluir en el lote',
  incluir: (descripcion: string, referencia: string) =>
    `Incluir en el lote: ${descripcion}, ${referencia}`,
  contador: (marcadas: number, total: number) =>
    marcadas === 0
      ? `0 de ${total} marcadas en esta página · Marca al menos una propuesta`
      : `${marcadas} de ${total} marcadas en esta página`,
  confirmar: (n: number) =>
    n === 0
      ? 'Confirmar propuestas'
      : n === 1
        ? 'Confirmar 1 propuesta'
        : `Confirmar ${n} propuestas`,
  /** Resultado con al menos una confirmada. */
  resultadoTitulo: (n: number) =>
    n === 1
      ? 'Lote confirmado: 1 propuesta.'
      : `Lote confirmado: ${n} propuestas.`,
  resultadoOmitidas: (n: number) =>
    n === 1
      ? '1 se omitió y sigue en la bandeja. Ninguna se confirmó a medias.'
      : `${n} se omitieron y siguen en la bandeja. Ninguna se confirmó a medias.`,
  /** Resultado donde todas se omitieron. */
  ningunaTitulo: 'No se confirmó ninguna propuesta.',
  ningunaOmitidas: (n: number) =>
    n === 1
      ? 'La única se omitió y sigue en la bandeja.'
      : `Las ${n} se omitieron y siguen en la bandeja.`,
  /** Resultado dudoso: puede que una parte se haya aplicado. */
  errorTitulo: 'No pudimos confirmar el resultado del lote.',
  errorDetalle:
    'Puede que una parte se haya aplicado. Recarga la bandeja para ver qué quedó.',
  recargar: 'Recargar bandeja',
} as const;
/** Reabrir un lote completo (5.8). Textos acordados en los mockups 2 y 7. */
export const REABRIR_LOTE = {
  accion: 'Reabrir lote',
  ayuda:
    'Vuelve a pendiente todo lo que este lote confirmó. Queda en la bitácora.',
  titulo: 'Reabrir lote',
  motivoEtiqueta: 'Motivo de la reapertura (obligatorio)',
  motivoEjemplo: 'Ej. confirmé el lote equivocado',
  motivoObligatorio: 'El motivo es obligatorio para reabrir.',
  motivoLargo: 'El motivo no puede pasar de 500 caracteres.',
  confirmar: 'Reabrir lote',
  reabriendo: 'Reabriendo…',
  cancelar: 'Cancelar',
  nota: 'Se reabre todo o nada, y cada caso queda en la bitácora con tu nombre y el motivo.',
  /** Región en vivo (solo lectores) mientras la reapertura viaja al servidor. */
  enviando: 'Reabriendo el lote',
  resultadoTitulo: (n: number) =>
    n === 1 ? 'Lote reabierto: 1 caso.' : `Lote reabierto: ${n} casos.`,
  resultadoTexto: (omitidas: number) => {
    const final =
      'Los casos reabiertos volvieron a la bandeja como pendientes.';
    if (omitidas === 0) return final;
    const cuantas =
      omitidas === 1
        ? '1 se omitió porque ya no estaba confirmada.'
        : `${omitidas} se omitieron porque ya no estaban confirmadas.`;
    return `${cuantas} ${final}`;
  },
  /** Resultado donde nada se reabrió: todas las del lote se omitieron. */
  ningunaTitulo: 'No se reabrió ningún caso.',
  ningunaOmitidas: (n: number) =>
    n === 1
      ? 'La única se omitió porque ya no estaba confirmada.'
      : `Las ${n} se omitieron porque ya no estaban confirmadas.`,
  /** El lote cambió (409) o ya no existe (404): no se reabrió nada. */
  falloTitulo: 'No se reabrió ningún caso.',
  falloDetalle:
    'El lote cambió mientras se reabría. Recarga la bandeja y vuelve a intentarlo.',
  /** Su rol lo tiene, pero el servidor dice que este lote no es suyo. */
  soloAutorOAdmin:
    'Solo quien confirmó el lote o un administrador puede reabrirlo.',
} as const;
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
