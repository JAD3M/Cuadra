import { clasificarErrorLectura } from './errores';

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
