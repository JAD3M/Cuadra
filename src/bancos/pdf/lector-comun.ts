import { dinero, type Dinero } from '../../common/dinero';
import { type MovimientoLeido } from '../lector-estado-cuenta';

/**
 * Piezas que comparten los lectores de PDF (AD-8): la forma del resultado y
 * los helpers de importes y meses. Cada banco conserva su propio layout.
 */

export interface LineaNoLeida {
  /** Línea del texto extraído, desde 1. */
  linea: number;
  texto: string;
}

export interface EstadoCuentaLeido {
  saldoInicial: string;
  saldoFinal: string;
  movimientos: MovimientoLeido[];
  lineasNoLeidas: LineaNoLeida[];
}

export const MESES: Record<string, number> = {
  ENE: 1,
  FEB: 2,
  MAR: 3,
  ABR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DIC: 12,
};

/** Importe con o sin miles, siempre con dos decimales. */
export const IMPORTE = String.raw`-?\d{1,3}(?:,\d{3})*\.\d{2}|-?\d+\.\d{2}`;

export function aDinero(texto: string): Dinero {
  return dinero(texto.replace(/,/g, ''));
}
