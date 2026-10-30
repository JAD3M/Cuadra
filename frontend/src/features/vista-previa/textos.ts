/**
 * Todo el texto de la vista previa vive aquí (VistaPrevia.dc.html, artboard
 * 18). Los componentes importan estas constantes en vez de escribir texto
 * propio. Los textos de conectividad y de permiso son los de la bandeja.
 */

import type { ClaseVistaPrevia, ConteoClases } from '@/shared/dominio';
import { plural } from '@/shared/texto/plural';

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

/** Sin respuesta: la acción pudo haberse aplicado, no se afirma que no. */
export const ERROR_RED_DECISION = {
  titulo: 'No pudimos confirmar el resultado.',
  detalle:
    'Se perdió la conexión y puede que la acción sí se haya aplicado. Revisa el estado de la carga en Cargas antes de reintentar.',
  ir: 'Ir a Cargas',
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

/** El bloque «Qué pasará al aceptar» (historia 3.5, VistaPrevia.dc.html). */
export const QUE_PASARA = {
  rotulo: 'Qué pasará al aceptar',
  nuevos: 'Nuevos · se importan',
  existentes: 'Ya existentes · se omiten',
  dudosos: 'Dudosos · entran a revisión',
  /** «11 nuevos, 2 ya existentes, 1 dudoso.» */
  resumen: ({ nuevos, existentes, dudosos }: ConteoClases): string =>
    `${plural(nuevos, 'nuevo', 'nuevos')}, ${plural(existentes, 'ya existente', 'ya existentes')}, ${plural(dudosos, 'dudoso', 'dudosos')}.`,
  tituloDudosos: (dudosos: number): string =>
    dudosos === 1 ? '1 movimiento dudoso' : `${dudosos} movimientos dudosos`,
  detalleDudosos:
    'Coinciden en cuenta, fecha y monto con uno que ya está cargado, pero la referencia es distinta. Entran como «pendiente de revisión»: no se concilian ni se descartan hasta que alguien los revise.',
  todoExistente:
    'Todos los movimientos de este PDF ya estaban cargados. Al aceptar no se importa nada nuevo y la carga se cierra.',
} as const;

export const MOVIMIENTOS = {
  titulo: 'Movimientos leídos',
  moneda: 'Montos en pesos mexicanos (MXN)',
  fecha: 'Fecha',
  referencia: 'Referencia',
  estado: 'Estado',
  monto: 'Monto',
} as const;

/** El chip «Estado» de cada movimiento, por la clase que dice el servidor. */
export const ESTADO_MOVIMIENTO: Readonly<Record<ClaseVistaPrevia, string>> = {
  nuevo: 'Nuevo',
  existente: 'Ya existe · se omite',
  dudoso: 'Dudoso · a revisión',
};

export const ACCIONES = {
  aceptar: 'Aceptar e importar',
  aceptando: 'Importando…',
  rechazar: 'Rechazar',
  rechazando: 'Rechazando…',
  /** Bajo el botón: qué se importará y qué se omite (historia 3.5). */
  pista: ({ nuevos, existentes, dudosos }: ConteoClases): string => {
    if (nuevos === 0 && dudosos === 0) {
      return 'No hay movimientos nuevos: al aceptar solo se cierra esta carga.';
    }
    const desglose =
      dudosos > 0
        ? ` (${plural(nuevos, 'nuevo', 'nuevos')} y ${plural(dudosos, 'dudoso', 'dudosos')})`
        : '';
    const omitidos =
      existentes > 0
        ? `; ${plural(existentes, 'ya existente se omite', 'ya existentes se omiten')}`
        : '';
    return `Se importarán ${plural(nuevos + dudosos, 'movimiento', 'movimientos')}${desglose}${omitidos}. Al aceptar, los nuevos pasan a conciliación y el motor corre al terminar.`;
  },
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
  titulo: 'Importación aceptada.',
  /**
   * Con lo que dijo el servidor; sin conteo, sin inventar cifras. «11
   * movimientos nuevos entraron a conciliación, 2 ya existían y se omitieron y
   * 1 dudoso quedó pendiente de revisión: no se concilia hasta que se revise.
   * El motor corre al terminar.»
   */
  detalle: (conteo: ConteoClases | undefined): string => {
    if (conteo === undefined) {
      return 'Los movimientos entraron a conciliación. El motor corre al terminar.';
    }
    const { nuevos, existentes, dudosos } = conteo;
    const entraron = `${nuevos} ${
      nuevos === 1 ? 'movimiento nuevo entró' : 'movimientos nuevos entraron'
    } a conciliación`;
    const omitidos =
      existentes > 0
        ? `, ${plural(existentes, 'ya existía', 'ya existían')} y se omiti${
            existentes === 1 ? 'ó' : 'eron'
          }`
        : '';
    const sing = dudosos === 1;
    const revision =
      dudosos > 0
        ? ` y ${plural(dudosos, 'dudoso quedó', 'dudosos quedaron')} pendiente${
            sing ? '' : 's'
          } de revisión: no se concilia${sing ? '' : 'n'} hasta que se revise${
            sing ? '' : 'n'
          }`
        : '';
    return `${entraron}${omitidos}${revision}. El motor corre al terminar.`;
  },
} as const;

export const BANNER_RECHAZADA = {
  titulo: 'Vista previa rechazada.',
  detalle:
    'No entró ningún movimiento a conciliación. Puedes volver a subir el mismo PDF si lo necesitas.',
} as const;
