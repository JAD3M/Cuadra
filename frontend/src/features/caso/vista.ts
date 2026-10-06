import { clasificarErrorLectura } from './errores';

// Derivación pura de lo que la pantalla del caso muestra. Nada se guarda: la
// vista sale siempre de lo que respondió el servidor, nunca del rol del
// usuario. El banner y el id del historial se agregan en una rebanada
// posterior.

/** Lo mínimo del caso que la derivación necesita. */
export interface CasoDerivable {
  estado: 'sugerencia' | 'sin_match' | 'conciliado';
  propuestas: readonly unknown[];
}

export type VistaCargada = 'sugerencia' | 'varias' | 'sin_match' | 'conciliado';

export type VistaLectura =
  'cargando' | 'no_encontrado' | 'sin_permiso' | 'contrato' | 'error';

/** Variante de un caso ya cargado, por el estado derivado del servidor. */
export function derivarVista(caso: CasoDerivable): VistaCargada {
  if (caso.estado === 'conciliado') return 'conciliado';
  if (caso.estado === 'sin_match') return 'sin_match';
  return caso.propuestas.length >= 2 ? 'varias' : 'sugerencia';
}

/**
 * La propuesta expandida: la elegida o, si ya no existe (por ejemplo la
 * rechazada), la primera, que es la mejor del servidor. Sin propuestas, `null`.
 */
export function propuestaSeleccionada<T extends { conciliacionId: string }>(
  propuestas: readonly T[],
  seleccion: string | null,
): T | null {
  return (
    propuestas.find((p) => p.conciliacionId === seleccion) ??
    propuestas[0] ??
    null
  );
}

export interface EntradaLectura {
  data: unknown;
  error: unknown;
  isPending: boolean;
}

/**
 * Vista de la capa de lectura. `null` cuando hay datos que mostrar o cuando
 * no hay nada que decir (un 401 lo atiende la capa de sesión).
 */
export function vistaDeLectura({
  data,
  error,
  isPending,
}: EntradaLectura): VistaLectura | null {
  if (data !== undefined) return null;
  if (error !== null && error !== undefined) {
    const clase = clasificarErrorLectura(error);
    if (clase === null) return null;
    return clase === 'conexion' ? 'error' : clase;
  }
  return isPending ? 'cargando' : null;
}
