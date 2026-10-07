import {
  ACCIONES_BITACORA,
  ENTIDADES_BITACORA,
  type AccionBitacora,
  type EntidadBitacora,
} from '@/shared/dominio';
import { esDiaValido } from './fechas';

// Estado de los filtros de la bitácora en la URL
// (`?entidad=…&accion=…&usuario=…&desde=…&hasta=…&pagina=N`). Igual que la
// bandeja: la URL es lo que escribe cualquiera, así que se lee con tolerancia
// (cada valor inválido se descarta por su cuenta y nunca llega a la API) y se
// escribe en una forma canónica única, para que dos URL equivalentes se
// normalicen a la misma y el contenedor pueda reescribir con `replace` sin
// crear historial. No se generaliza `bandeja/filtrosUrl.ts`: su núcleo es un
// conjunto de estados con valores por defecto, que aquí no existe.

export interface FiltrosBitacora {
  entidad?: EntidadBitacora;
  accion?: AccionBitacora;
  /** Id (uuid en minúsculas) del autor; la API lo recibe como `userId`. */
  usuario?: string;
  /** Día local `AAAA-MM-DD`, inclusivo. */
  desde?: string;
  /** Día local `AAAA-MM-DD`, inclusivo. */
  hasta?: string;
  /** Entero desde 1. */
  pagina: number;
}

// Misma expresión que `PAGINA_VALIDA` de la bandeja, copiada a propósito: no se
// generaliza el lector de la bandeja por una sola línea (y tocar sus pruebas).
const PAGINA_VALIDA = /^[1-9]\d{0,5}$/;

// Cualquier versión de uuid, solo en minúsculas (el backend valida `IsUUID()`).
const UUID_MINUSCULAS =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function entidadValida(valor: unknown): valor is EntidadBitacora {
  return (
    typeof valor === 'string' &&
    (ENTIDADES_BITACORA as readonly string[]).includes(valor)
  );
}

function accionValida(valor: unknown): valor is AccionBitacora {
  return (
    typeof valor === 'string' &&
    (ACCIONES_BITACORA as readonly string[]).includes(valor)
  );
}

function usuarioValido(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_MINUSCULAS.test(valor);
}

function diaValido(valor: unknown): valor is string {
  return typeof valor === 'string' && esDiaValido(valor);
}

function paginaValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1;
}

/**
 * Filtros a partir de la URL. Ausentes o inválidos dan «sin filtro» y página 1;
 * con una clave repetida solo cuenta la primera; las demás claves se ignoran.
 */
export function leerFiltros(params: URLSearchParams): FiltrosBitacora {
  const entidad = params.get('entidad');
  const accion = params.get('accion');
  const usuario = params.get('usuario');
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  const pagina = params.get('pagina');
  const filtros: FiltrosBitacora = {
    pagina: pagina !== null && PAGINA_VALIDA.test(pagina) ? Number(pagina) : 1,
  };
  if (entidadValida(entidad)) filtros.entidad = entidad;
  if (accionValida(accion)) filtros.accion = accion;
  if (usuarioValido(usuario)) filtros.usuario = usuario;
  if (diaValido(desde)) filtros.desde = desde;
  if (diaValido(hasta)) filtros.hasta = hasta;
  return filtros;
}

/**
 * Cadena de consulta canónica (sin `?`): orden entidad, accion, usuario,
 * desde, hasta, pagina. Omite lo ausente, lo inválido y la página 1.
 */
export function serializar(filtros: FiltrosBitacora): string {
  const consulta = new URLSearchParams();
  if (entidadValida(filtros.entidad)) consulta.set('entidad', filtros.entidad);
  if (accionValida(filtros.accion)) consulta.set('accion', filtros.accion);
  if (usuarioValido(filtros.usuario)) consulta.set('usuario', filtros.usuario);
  if (diaValido(filtros.desde)) consulta.set('desde', filtros.desde);
  if (diaValido(filtros.hasta)) consulta.set('hasta', filtros.hasta);
  if (paginaValida(filtros.pagina) && filtros.pagina > 1) {
    consulta.set('pagina', String(filtros.pagina));
  }
  return consulta.toString();
}

/**
 * Aplica un cambio de filtros y vuelve SIEMPRE a la página 1: la página que se
 * miraba ya no significa nada con otro filtro. No muta el original.
 */
export function cambiar(
  filtros: FiltrosBitacora,
  parche: Partial<Omit<FiltrosBitacora, 'pagina'>>,
): FiltrosBitacora {
  return { ...filtros, ...parche, pagina: 1 };
}

/** `true` sin ningún filtro activo. La página no es un filtro. */
export function esPorDefecto(filtros: FiltrosBitacora): boolean {
  return (
    filtros.entidad === undefined &&
    filtros.accion === undefined &&
    filtros.usuario === undefined &&
    filtros.desde === undefined &&
    filtros.hasta === undefined
  );
}
