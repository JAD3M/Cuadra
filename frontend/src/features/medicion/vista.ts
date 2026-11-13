import type { TasaDeDesacuerdo } from '@/shared/api/contratos';
import { formatearTasa } from './formato';

/** Lo que muestra la tarjeta de la tasa. */
export type VistaMedicion =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  /** Cuadra aún no propuso nada de la regla 1: no hay tasa que mostrar. */
  | { tipo: 'sin_datos' }
  /** Hay propuestas, pero el equipo no ha tratado ninguna: tampoco hay tasa. */
  | { tipo: 'sin_tratadas'; propuestas: number }
  | {
      tipo: 'listo';
      tasa: string;
      propuestas: number;
      tratadas: number;
      desacuerdos: number;
    };

export interface EntradaVista {
  cargando: boolean;
  error: boolean;
  datos: TasaDeDesacuerdo | undefined;
}

/**
 * Deriva la vista de la lectura. «Sin datos» y «sin tratadas» nunca se
 * convierten en un 0 %: un cero así afirmaría que el equipo está de acuerdo
 * cuando todavía no hay con qué medirlo.
 */
export function vistaMedicion({
  cargando,
  error,
  datos,
}: EntradaVista): VistaMedicion {
  if (error) return { tipo: 'error' };
  if (cargando || datos === undefined) return { tipo: 'cargando' };
  if (datos.propuestas === 0) return { tipo: 'sin_datos' };
  const tasa = datos.tasa === null ? null : formatearTasa(datos.tasa);
  if (tasa === null) {
    return { tipo: 'sin_tratadas', propuestas: datos.propuestas };
  }
  return {
    tipo: 'listo',
    tasa,
    propuestas: datos.propuestas,
    tratadas: datos.tratadas,
    desacuerdos: datos.desacuerdos,
  };
}
