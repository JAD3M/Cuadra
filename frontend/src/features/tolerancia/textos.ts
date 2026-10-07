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
