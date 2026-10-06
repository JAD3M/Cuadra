import estilos from './BarraAvance.module.css';

export interface BarraIndeterminadaProps {
  /** Id del texto visible que nombra la barra. */
  etiquetadaPor: string;
}

/**
 * La barra indeterminada de Avance (misma pista y mismo movimiento), sin
 * pasar por un estado: el panel de resultado la usa mientras la carga está
 * pendiente o procesando. Sin `aria-valuenow`: no se sabe cuánto falta.
 */
export function BarraIndeterminada({ etiquetadaPor }: BarraIndeterminadaProps) {
  return (
    <div
      className={estilos.pista}
      role="progressbar"
      aria-labelledby={etiquetadaPor}
    >
      <div className={`${estilos.relleno} ${estilos.indeterminada}`} />
    </div>
  );
}
