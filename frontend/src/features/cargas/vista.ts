import {
  TIPO_CFDI,
  esActiva,
  puede,
  type EstadoCarga,
  type Permiso,
  type TipoCarga,
} from '@/shared/dominio';
import { clasificarErrorLectura } from './errores';
import { YA_EXISTIA_EN_COLA, YA_EXISTIA_TERMINADA } from './textos';

// Derivación pura de lo que la pantalla de cargas muestra. Nada se guarda: la
// vista sale siempre de lo que respondió el servidor.

/**
 * Qué muestra el historial. Los nombres evitan los literales de dominio que
 * la prueba de espejo prohíbe en el código de la pantalla.
 */
export type VistaHistorial =
  'cargando' | 'vacio' | 'tabla' | 'fallo' | 'sin_permiso';

export interface EntradaHistorial {
  data: { datos: readonly unknown[] } | undefined;
  error: unknown;
  isPending: boolean;
}

/**
 * Vista del historial. Con datos siempre hay algo que mostrar: un sondeo que
 * falla no esconde la tabla ya cargada. Sin datos, un fallo se clasifica como
 * en el detalle del caso: 403 sin permiso, 401 y cancelación sin mensaje (los
 * atiende la capa de sesión) y el resto conectividad. `null` = nada que decir.
 */
export function vistaHistorial({
  data,
  error,
  isPending,
}: EntradaHistorial): VistaHistorial | null {
  if (data !== undefined) return data.datos.length === 0 ? 'vacio' : 'tabla';
  if (error !== null && error !== undefined) {
    const clase = clasificarErrorLectura(error);
    if (clase === null) return null;
    return clase === 'sin_permiso' ? 'sin_permiso' : 'fallo';
  }
  return isPending ? 'cargando' : null;
}

/**
 * Quién puede subir cargas: quien tiene la capacidad `cargas.cargar` que
 * entregó el servidor. Es comodidad: el servidor decide, y una capacidad vieja
 * se degrada al texto de «sin permiso» cuando el POST responde 403.
 */
export const puedeSubir = (capacidades: readonly Permiso[]): boolean =>
  puede(capacidades, 'cargas.cargar');

/**
 * Qué muestra el panel de la carga recién subida. Los nombres evitan los
 * literales de dominio que la prueba de espejo prohíbe en el código de la
 * pantalla.
 *  - `en_curso`: el servidor aún trabaja (pendiente o procesando).
 *  - `por_archivo`: terminó un lote de CFDI; se lista cada archivo.
 *  - `por_fila`: terminó un estado de cuenta; se listan las filas con error.
 *  - `sin_proceso`: la carga falló; no hay lista.
 */
export type VistaPanel =
  'ninguno' | 'en_curso' | 'por_archivo' | 'por_fila' | 'sin_proceso';

export interface EntradaPanel {
  /** La carga recién subida; `null` si aún no hay. */
  panel: { tipo: TipoCarga; epoca: number } | null;
  /** Lo último que se sabe de esa carga (el detalle o, si no, el POST). */
  datos: { estado: EstadoCarga } | null;
  /** La época vigente de la sesión. */
  epoca: number | null;
}

/**
 * Vista del panel de resultado. Un panel de otra época no se muestra: nada de
 * lo que subió otra empresa o sesión aparece en la actual (CRG-9).
 */
export function derivarPanel({
  panel,
  datos,
  epoca,
}: EntradaPanel): VistaPanel {
  if (panel === null || datos === null) return 'ninguno';
  if (epoca === null || panel.epoca !== epoca) return 'ninguno';
  if (esActiva(datos.estado)) return 'en_curso';
  if (datos.estado === 'fallida') return 'sin_proceso';
  return panel.tipo === TIPO_CFDI ? 'por_archivo' : 'por_fila';
}

/**
 * K7: qué decir de una carga que ya existía. Lo decide el estado que devolvió
 * el servidor, no si respondió 200 o 202: terminada, no se duplicó nada; en
 * cola o fallida, se volvió a poner en la cola.
 */
export function mensajeYaExistia(estado: EstadoCarga): readonly string[] {
  return estado === 'procesada' || estado === 'con_errores'
    ? YA_EXISTIA_TERMINADA
    : YA_EXISTIA_EN_COLA;
}

/** Qué dice el aviso del polling junto al historial (G13, K5). */
export type EstadoActualizacion = 'actualizando' | 'detenida';

export interface EntradaActualizacion {
  vista: VistaHistorial | null;
  /** Hay algo que el servidor sigue procesando (lista o panel). */
  activo: boolean;
  /** El tope de la ventana de polling ya venció. */
  capada: boolean;
}

/**
 * El aviso del polling. Solo con la tabla a la vista (el mockup no lo pone con
 * el esqueleto, el vacío ni el error) y solo mientras haya algo activo: sin
 * nada activo no hay nada que actualizar, aunque el tope haya vencido.
 */
export function estadoActualizacion({
  vista,
  activo,
  capada,
}: EntradaActualizacion): EstadoActualizacion | null {
  if (vista !== 'tabla' || !activo) return null;
  return capada ? 'detenida' : 'actualizando';
}
