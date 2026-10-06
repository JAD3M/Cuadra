import { ETIQUETAS_ESTADO_CARGA, type EstadoCarga } from '@/shared/dominio';
import { nombreDeAvance } from '@/features/cargas/textos';
import { AVANCE_ESTADO_CARGA } from '@/features/cargas/tonos';
import estilos from './BarraAvance.module.css';

export interface BarraAvanceProps {
  estado: EstadoCarga;
}

/**
 * Avance de una carga. Sale solo del estado, nunca de los contadores: vacía
 * (pendiente), indeterminada y animada (procesando) o llena en el color del
 * resultado. Sin porcentaje ni número: el servidor no informa el avance.
 *
 * Procesando es una `progressbar` sin `aria-valuenow` (indeterminada); los
 * demás son una imagen. Todas llevan el nombre «Avance: {estado}».
 */
export function BarraAvance({ estado }: BarraAvanceProps) {
  const avance = AVANCE_ESTADO_CARGA[estado];
  return (
    <div
      className={estilos.pista}
      role={avance === 'indeterminada' ? 'progressbar' : 'img'}
      aria-label={nombreDeAvance(ETIQUETAS_ESTADO_CARGA[estado])}
      data-avance={avance}
    >
      <div className={`${estilos.relleno} ${estilos[avance]}`} />
    </div>
  );
}
