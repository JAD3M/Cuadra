import type { ReactNode } from 'react';
import estilos from './EstadoChip.module.css';

/**
 * Tonos de presentación. No son estados de dominio: la pantalla decide qué
 * valor de la API se muestra con qué tono.
 */
export const TONOS_ESTADO_CHIP = [
  'sugerencia',
  'sin_match',
  'conciliado',
  'neutral',
  'ia',
  'peligro',
] as const;

export type TonoEstadoChip = (typeof TONOS_ESTADO_CHIP)[number];

export interface EstadoChipProps {
  tono: TonoEstadoChip;
  /** Texto del chip. Siempre visible: el color nunca es el único canal. */
  children: ReactNode;
}

function esTono(valor: string): valor is TonoEstadoChip {
  return (TONOS_ESTADO_CHIP as readonly string[]).includes(valor);
}

/**
 * Chip de estado. Un tono desconocido en tiempo de ejecución (por ejemplo un
 * valor que escapó al tipo) se pinta como neutral: nunca se hace pasar por un
 * estado válido.
 */
export function EstadoChip({ tono, children }: EstadoChipProps) {
  const efectivo: TonoEstadoChip = esTono(tono) ? tono : 'neutral';
  return (
    <span
      className={`${estilos.chip} ${estilos[efectivo]}`}
      data-tono={efectivo}
    >
      {children}
    </span>
  );
}
