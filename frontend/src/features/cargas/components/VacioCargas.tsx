import { VACIO_CARGAS } from '@/features/cargas/textos';
import estilos from './VacioCargas.module.css';

/** El historial respondió sin cargas: solo informa, no hay acción posible. */
export function VacioCargas() {
  return (
    <div className={estilos.vacio}>
      <strong className={estilos.titulo}>{VACIO_CARGAS.titulo}</strong>
      <span className={estilos.detalle}>{VACIO_CARGAS.detalle}</span>
    </div>
  );
}
