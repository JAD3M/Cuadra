import { useId } from 'react';
import { PROCESANDO_CARGA } from '@/features/cargas/textos';
import { BarraIndeterminada } from './BarraIndeterminada';
import estilos from './resultado.module.css';

export interface ResultadoProcesandoProps {
  /** Por omisión, «Procesando la carga…»; la lectura de un PDF dice otra cosa. */
  texto?: string;
}

/**
 * La carga aún se procesa (pendiente o procesando): el texto y una barra
 * indeterminada, sin número ni porcentaje. No abre región propia: la región
 * del panel ya es la que anuncia.
 */
export function ResultadoProcesando({
  texto = PROCESANDO_CARGA,
}: ResultadoProcesandoProps) {
  const idTexto = useId();
  return (
    <div className={estilos.caja}>
      <span id={idTexto} className={estilos.resumen}>
        {texto}
      </span>
      <BarraIndeterminada etiquetadaPor={idTexto} />
    </div>
  );
}
