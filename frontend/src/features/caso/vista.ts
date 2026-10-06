import { clasificarErrorLectura, type AccionCaso } from './errores';
import { formatearDiaDeInstante } from './fecha';
import { BANNER } from './textos';

// Derivación pura de lo que la pantalla del caso muestra. Nada se guarda: la
// vista sale siempre de lo que respondió el servidor, nunca del rol del
// usuario.

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

/** Lo que se sabe de la última resolución exitosa de la época vigente. */
export interface ResolucionVigente {
  accion: AccionCaso;
  /** Id de la conciliación resuelta, tomado de la respuesta del POST. */
  conciliacionId: string;
  /** Cuántas hermanas rechazó el servidor al confirmar. */
  rechazadas: number;
}

/** Lo que el banner necesita del caso vuelto a pedir. */
export interface CasoParaBanner {
  estado: 'sugerencia' | 'sin_match' | 'conciliado';
  propuestas: readonly {
    confirmadaAt: string | null;
    confirmadaPor: { nombre: string } | null;
  }[];
}

export interface Banner {
  accion: AccionCaso;
  /** «{usuario} · {fecha}» del caso vuelto a pedir; solo al confirmar. */
  detalle: string | null;
  nota: string | null;
}

function notaDeConfirmar(rechazadas: number): string | null {
  if (rechazadas <= 0) return null;
  return rechazadas === 1 ? BANNER.unaHermana : BANNER.variasHermanas;
}

function notaDeRechazar(caso: CasoParaBanner | undefined): string | null {
  if (caso === undefined) return null;
  if (caso.estado === 'sin_match') return BANNER.vuelveASinMatch;
  if (caso.estado !== 'sugerencia' || caso.propuestas.length === 0) return null;
  return caso.propuestas.length === 1
    ? BANNER.queda
    : BANNER.quedan(caso.propuestas.length);
}

/**
 * Banner de una resolución: el título sale de la acción que el servidor
 * aceptó; el usuario, la fecha y la nota, del caso vuelto a pedir (nunca de
 * un resultado supuesto). Sin caso, o con un caso que no lo confirma, la
 * parte que depende de él se omite.
 */
export function bannerDe(
  resolucion: ResolucionVigente,
  caso: CasoParaBanner | undefined,
  zona?: string,
): Banner {
  if (resolucion.accion === 'rechazar') {
    return {
      accion: 'rechazar',
      detalle: null,
      nota: notaDeRechazar(caso),
    };
  }
  const confirmada =
    caso !== undefined && caso.estado === 'conciliado'
      ? caso.propuestas[0]
      : undefined;
  const partes = [
    confirmada?.confirmadaPor?.nombre ?? null,
    confirmada?.confirmadaAt
      ? formatearDiaDeInstante(confirmada.confirmadaAt, zona)
      : null,
  ].filter((parte): parte is string => parte !== null);
  return {
    accion: 'confirmar',
    detalle: partes.length === 0 ? null : partes.join(BANNER.separadorDetalle),
    nota: notaDeConfirmar(resolucion.rechazadas),
  };
}

/**
 * Id cuyo historial se pide. Tras rechazar la última propuesta no queda
 * ninguna que mostrar, así que se usa la de la respuesta del POST (R5/B5);
 * un sin_match común no tiene historial.
 */
export function historialIdDe(
  resolucion: ResolucionVigente | null,
  propuestas: readonly unknown[],
  seleccionada: { conciliacionId: string } | null,
): string | null {
  if (resolucion?.accion === 'rechazar' && propuestas.length === 0) {
    return resolucion.conciliacionId;
  }
  return seleccionada?.conciliacionId ?? null;
}
