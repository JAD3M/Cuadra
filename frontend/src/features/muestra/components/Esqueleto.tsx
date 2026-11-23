import { CARGANDO } from '@/features/muestra/textos';
import estilos from './Esqueleto.module.css';

/** Carga de la muestra: la tarjeta de avance y las dos columnas, decorativas. */
export function Esqueleto() {
  return (
    <div role="status" aria-busy="true" className={estilos.esqueleto}>
      <span className={estilos.oculto}>{CARGANDO}</span>
      <div className={`${estilos.bloque} ${estilos.avance}`} />
      <div className={estilos.dos}>
        <div className={`${estilos.bloque} ${estilos.columna}`} />
        <div className={`${estilos.bloque} ${estilos.columna}`} />
      </div>
    </div>
  );
}
