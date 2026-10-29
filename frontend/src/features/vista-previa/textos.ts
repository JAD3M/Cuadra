/**
 * Todo el texto de la vista previa vive aquí (VistaPrevia.dc.html, artboard
 * 18). Los componentes importan estas constantes en vez de escribir texto
 * propio. Los textos de conectividad y de permiso son los de la bandeja.
 */

export {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/bandeja/textos';

export const TITULO_VISTA_PREVIA = 'Vista previa';
export const TITULO_DOCUMENTO_VISTA_PREVIA = 'Vista previa · Cuadra';
export const SUBTITULO_VISTA_PREVIA =
  'Revisa lo que Cuadra leyó del PDF. Nada entra a conciliación hasta que lo aceptes.';

export const VOLVER_A_CARGAS = 'Volver a Cargas';
export const IR_A_BANDEJA = 'Ir a la bandeja';

export const CARGANDO_VISTA_PREVIA = 'Cargando vista previa';

/** Chip de estado que no sale de las etiquetas del dominio. */
export const CHIP = {
  importando: 'Importando',
  rechazando: 'Rechazando',
} as const;

export const NO_ENCONTRADA = {
  titulo: 'No encontramos esta carga.',
  detalle: 'Puede que no exista o que pertenezca a otra empresa.',
} as const;

export const YA_RESUELTA = {
  titulo: 'Esta carga ya no está en espera.',
  detalle:
    'Otra persona pudo haberla aceptado o rechazado hace un momento. Revisa su estado en Cargas.',
} as const;

/** El servidor falló al decidir: se dice qué NO pasó. */
export const ERROR_DECISION = {
  titulo: 'No se pudo completar la solicitud.',
  aceptar:
    'No se aceptó nada: ningún movimiento entró a conciliación. Inténtalo de nuevo en unos minutos.',
  rechazar:
    'No se rechazó nada: la vista previa sigue en espera. Inténtalo de nuevo en unos minutos.',
} as const;

export const SOLO_CONSULTA = {
  titulo: 'Tu rol solo permite consultar las cargas.',
  detalle:
    'Pide a un administrador o contador que acepte o rechace esta vista previa.',
} as const;

export const RESUMEN = {
  nombre: 'Resumen de la lectura',
  rotulo: 'Resumen',
  movimientos: 'Movimientos leídos',
  saldoInicial: 'Saldo inicial',
  saldoFinal: 'Saldo final',
  cuadran: 'Los saldos cuadran con los movimientos.',
  sinSaldos:
    'Esta carga se leyó antes de que Cuadra guardara los saldos del PDF, así que no se pueden mostrar.',
} as const;

export const MOVIMIENTOS = {
  titulo: 'Movimientos leídos',
  moneda: 'Montos en pesos mexicanos (MXN)',
  fecha: 'Fecha',
  referencia: 'Referencia',
  monto: 'Monto',
} as const;

export const ACCIONES = {
  aceptar: 'Aceptar e importar',
  aceptando: 'Importando…',
  rechazar: 'Rechazar',
  rechazando: 'Rechazando…',
  pista:
    'Al aceptar, los movimientos pasan a conciliación y el motor corre al terminar.',
  progresoAceptar: 'Importando los movimientos',
  progresoRechazar: 'Rechazando la vista previa',
} as const;

export const CONFIRMAR_RECHAZO = {
  titulo: '¿Rechazar esta vista previa?',
  confirmar: 'Sí, rechazar',
  cancelar: 'Cancelar',
  /** «Se descartarán los 14 movimientos leídos…» / «Se descartará el movimiento leído…». */
  detalle: (total: number): string =>
    `${
      total === 1
        ? 'Se descartará el movimiento leído'
        : `Se descartarán los ${total} movimientos leídos`
    } y no entrará nada a conciliación. Podrás volver a subir el PDF.`,
} as const;

export const BANNER_ACEPTADA = {
  /** Con la cuenta que dijo el servidor; sin ella, sin inventar cifras. */
  titulo: (movimientos: number | undefined): string => {
    if (movimientos === undefined) {
      return 'Importación aceptada. Los movimientos entraron a conciliación.';
    }
    return movimientos === 1
      ? 'Importación aceptada. El movimiento entró a conciliación.'
      : `Importación aceptada. Los ${movimientos} movimientos entraron a conciliación.`;
  },
  detalle: 'El motor corre al terminar. Los casos aparecerán en la bandeja.',
} as const;

export const BANNER_RECHAZADA = {
  titulo: 'Vista previa rechazada.',
  detalle:
    'No entró ningún movimiento a conciliación. Puedes volver a subir el mismo PDF si lo necesitas.',
} as const;
