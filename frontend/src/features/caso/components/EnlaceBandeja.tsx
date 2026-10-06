import { Link } from 'react-router';
import estilos from './EnlaceBandeja.module.css';

export interface EnlaceBandejaProps {
  texto: string;
  /**
   * `atras`: enlace de regreso al inicio de la página. `accion`: salida de un
   * estado de error, con el aspecto de un botón secundario.
   */
  variante: 'atras' | 'accion';
}

/** Enlace a `/bandeja`: el de regreso del encabezado y la salida de los errores. */
export function EnlaceBandeja({ texto, variante }: EnlaceBandejaProps) {
  return (
    <Link className={estilos[variante]} to="/bandeja">
      {texto}
    </Link>
  );
}
