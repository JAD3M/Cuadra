import { CARGANDO_CARGAS } from '@/features/cargas/textos';
import estilos from './EsqueletoCargas.module.css';

/** Barras de relleno de la carga inicial (mockup: cinco). */
const BARRAS = 5;

/**
 * Esqueleto del historial mientras llega. La región está ocupada y anuncia
 * «Cargando cargas»; las barras son decorativas y no hay nada que activar.
 */
export function EsqueletoCargas() {
  return (
    <div role="status" aria-busy="true" className={estilos.esqueleto}>
      <span className="solo-lectores">{CARGANDO_CARGAS}</span>
      {Array.from({ length: BARRAS }, (_, i) => (
        <div key={i} className={estilos.barra} aria-hidden="true" />
      ))}
    </div>
  );
}
