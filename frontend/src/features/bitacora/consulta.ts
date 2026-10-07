import type { AccionBitacora, EntidadBitacora } from '@/shared/dominio';
import { LIMITE_PAGINA } from './constantes';
import {
  esRangoInvertido,
  inicioDelDia,
  inicioDelDiaSiguiente,
} from './fechas';
import type { FiltrosBitacora } from './filtrosUrl';

/**
 * Lo que se envía a `GET /bitacora`, y la parte de la clave de caché que
 * identifica la lista: exactamente lo pedido, nada más.
 */
export interface ConsultaBitacora {
  entidad?: EntidadBitacora;
  accion?: AccionBitacora;
  userId?: string;
  /** Primer instante del día local de «Desde», ISO UTC. */
  desde?: string;
  /** Primer instante del día local SIGUIENTE a «Hasta», ISO UTC (la API es [desde, hasta)). */
  hasta?: string;
  pagina: number;
  limite: number;
}

/**
 * Consulta para unos filtros, o `null` cuando «Desde» es posterior a «Hasta»:
 * entonces no se envía nada (la pantalla avisa el rango). El mismo día en ambos
 * lados es un día completo, nunca un 400. Solo «Hasta» manda solo `hasta`.
 */
export function armarConsulta(
  filtros: FiltrosBitacora,
): ConsultaBitacora | null {
  if (esRangoInvertido(filtros.desde, filtros.hasta)) return null;
  const consulta: ConsultaBitacora = {
    pagina: filtros.pagina,
    limite: LIMITE_PAGINA,
  };
  if (filtros.entidad !== undefined) consulta.entidad = filtros.entidad;
  if (filtros.accion !== undefined) consulta.accion = filtros.accion;
  if (filtros.usuario !== undefined) consulta.userId = filtros.usuario;
  if (filtros.desde !== undefined) consulta.desde = inicioDelDia(filtros.desde);
  if (filtros.hasta !== undefined) {
    consulta.hasta = inicioDelDiaSiguiente(filtros.hasta);
  }
  return consulta;
}

/**
 * Ruta de `GET /bitacora` con el orden fijo entidad, accion, userId, desde,
 * hasta, pagina, limite. Los filtros ausentes no se envían; la página y el
 * límite van siempre, para no depender de los valores por defecto del servidor.
 */
export function rutaBitacora(consulta: ConsultaBitacora): string {
  const parametros = new URLSearchParams();
  if (consulta.entidad !== undefined) {
    parametros.set('entidad', consulta.entidad);
  }
  if (consulta.accion !== undefined) parametros.set('accion', consulta.accion);
  if (consulta.userId !== undefined) parametros.set('userId', consulta.userId);
  if (consulta.desde !== undefined) parametros.set('desde', consulta.desde);
  if (consulta.hasta !== undefined) parametros.set('hasta', consulta.hasta);
  parametros.set('pagina', String(consulta.pagina));
  parametros.set('limite', String(consulta.limite));
  return `/bitacora?${parametros.toString()}`;
}
