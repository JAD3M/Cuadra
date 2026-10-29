import { CARGANDO_VISTA_PREVIA } from '@/features/vista-previa/textos';
import estilos from './EsqueletoVistaPrevia.module.css';

/**
 * Esqueleto mientras llega la vista previa. La región está ocupada y se llama
 * «Cargando vista previa»; los bloques son decorativos y no hay nada que
 * activar.
 */
export function EsqueletoVistaPrevia() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={CARGANDO_VISTA_PREVIA}
      className={estilos.esqueleto}
    >
      <div className={estilos.resumen} aria-hidden="true" />
      <div className={estilos.tabla} aria-hidden="true" />
    </div>
  );
}
