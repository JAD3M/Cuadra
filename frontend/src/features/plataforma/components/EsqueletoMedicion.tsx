import { TEXTOS_MEDICION_PLATAFORMA as T } from '@/features/plataforma/textos';
import estilos from './MedicionPlataforma.module.css';

/** Esqueleto mientras llegan las lecturas; se anuncia como estado de carga. */
export function EsqueletoMedicion() {
  return (
    <div role="status" aria-busy="true" className={estilos.esqueleto}>
      <span className={estilos.soloLector}>{T.cargando}</span>
      <span className={`${estilos.barra} ${estilos.barraTitulo}`} />
      <span className={estilos.barra} />
      <span className={estilos.barra} />
      <span className={estilos.barra} />
    </div>
  );
}
