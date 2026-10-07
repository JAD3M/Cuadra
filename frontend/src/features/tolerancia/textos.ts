import { ERROR_CONEXION, ERROR_SIN_PERMISO } from '@/features/bandeja/textos';
import type { MotivoInvalido } from './validarTolerancia';

// Textos de la pantalla de Tolerancia, centralizados para que el copy no se
// disperse en los componentes. Los avisos compartidos (conexión, sin permiso,
// Reintentar) se reutilizan de la bandeja; aquí solo va lo propio.

/** Mensaje de cada motivo por el que un borrador no se puede guardar. */
export const MOTIVOS_INVALIDO: Readonly<Record<MotivoInvalido, string>> = {
  vacio: 'Escribe un valor.',
  formato: 'Escribe un número con punto decimal, por ejemplo 0.50.',
  rango: 'El valor debe estar entre 0 y 100.',
  decimales: 'Usa hasta 4 decimales.',
};

// Los avisos compartidos de conectividad y de permiso, y «Reintentar», son los
// de la bandeja (M10), igual que en Cargas.
export {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/bandeja/textos';

/** Título del documento y del encabezado de la página (Tolerancia.dc.html v30). */
export const TITULO_DOCUMENTO = 'Tolerancia · Cuadra';
export const TITULO_PAGINA = 'Tolerancia de monto';

/** Subtítulo del encabezado: lleva el nombre de la empresa activa (decisión Q8). */
export const subtituloPagina = (empresa: string): string =>
  `${empresa} · aplica a movimientos y CFDI en MXN`;

/** Tarjeta del valor vigente. */
export const VALOR_ACTUAL = 'Valor actual';
export const MONEDA = 'MXN';
export const EXPLICACION_VALOR =
  'Si la referencia coincide y el monto difiere hasta este valor, el motor todavía propone el cruce y lo marca con la diferencia. En otra moneda la tolerancia es cero.';

/** Texto solo para lectores de pantalla de los esqueletos de carga. */
export const CARGANDO_TOLERANCIA = 'Cargando la tolerancia';
export const CARGANDO_CAMBIOS = 'Cargando los cambios';

/** Lo que ve quien no administra la empresa en lugar del formulario. */
export const AVISO_SOLO_ADMIN =
  'Solo un administrador de la empresa puede cambiar la tolerancia.';

/**
 * Fallo de lectura que no es de conexión ni de permiso (otro estado HTTP o
 * una respuesta fuera de contrato): solo el título genérico, sin texto del
 * servidor.
 */
export const ERROR_LECTURA_OTRO = {
  titulo: 'No se pudo completar la solicitud.',
} as const;

/** Formulario de cambio (solo administradores). */
export const ETIQUETA_CAMPO = 'Nuevo valor (0 a 100, hasta 4 decimales)';
export const AYUDA_NORMAL =
  'El cambio queda en la bitácora con el valor anterior y el nuevo. Solo afecta corridas futuras del motor.';
export const AYUDA_MISMO_VALOR =
  'Es el valor actual. Escribe otro para guardar.';
export const GUARDAR = 'Guardar';
export const GUARDANDO = 'Guardando…';
/** Texto solo para lectores de pantalla mientras el PUT está en curso. */
export const GUARDANDO_ESTADO = 'Guardando la tolerancia';
export const EXITO_GUARDADO =
  'Tolerancia guardada. Aplica desde la próxima corrida del motor.';

/**
 * Alertas de un guardado fallido, por clase. Nunca llevan texto del servidor:
 * el 400 de Nest nombra `toleranciaMonto` y es para quien desarrolla. Todas
 * menos «sin permiso» dicen que el valor escrito sigue en el campo. El rechazo
 * (400) es una sola frase, sin detalle.
 */
export const ERROR_GUARDADO = {
  rechazo: {
    titulo:
      'El servidor no aceptó el valor. Escribe un número entre 0 y 100, con hasta 4 decimales.',
  },
  sin_permiso: ERROR_SIN_PERMISO,
  conexion: {
    titulo: ERROR_CONEXION.titulo,
    detalle:
      'Revisa tu conexión e inténtalo de nuevo. El valor que escribiste sigue en el campo.',
  },
  otro: {
    titulo: ERROR_LECTURA_OTRO.titulo,
    detalle:
      'El valor que escribiste sigue en el campo. Inténtalo de nuevo en unos minutos.',
  },
} as const;

/** Tarjeta de cambios recientes (sin enlace a la bitácora hasta CU-26). */
export const CAMBIOS_RECIENTES = 'Cambios recientes';
export const ULTIMOS_CAMBIOS = 'Últimos 5 cambios';
export const SIN_CAMBIOS = {
  titulo: 'Aún no hay cambios.',
  detalle: 'Cuando un administrador cambie la tolerancia, aparecerá aquí.',
} as const;
/** Quien cambió el valor cuando el evento no trae usuario. */
export const SIN_AUTOR = '—';
/**
 * Fallo de lectura de los cambios por conexión: título propio y el detalle
 * compartido de «revisa tu conexión».
 */
export const ERROR_CAMBIOS = {
  titulo: 'No se pudieron cargar los cambios.',
  detalle: 'Revisa tu conexión e inténtalo de nuevo.',
} as const;
