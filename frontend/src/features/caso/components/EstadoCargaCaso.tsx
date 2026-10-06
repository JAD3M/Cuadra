import { CARGANDO_CASO } from '@/features/caso/textos';
import estilos from './EstadoCargaCaso.module.css';

/**
 * Esqueleto del caso mientras llega. La región está ocupada y anuncia
 * «Cargando caso» a los lectores de pantalla; los bloques son decorativos y
 * no hay ninguna acción que se pueda activar.
 */
export function EstadoCargaCaso() {
  return (
    <div role="status" aria-busy="true" className={estilos.esqueleto}>
      <span className="solo-lectores">{CARGANDO_CASO}</span>
      <div className={estilos.titulo} aria-hidden="true" />
      <div className={estilos.par} aria-hidden="true">
        <div className={estilos.tarjeta} />
        <div className={estilos.tarjeta} />
      </div>
      <div className={estilos.ancha} aria-hidden="true" />
    </div>
  );
}
