import { Link } from 'react-router';
import { VOLVER_A_CARGAS } from '@/features/vista-previa/textos';
import estilos from './enlaces.module.css';

export interface EnlaceCargasProps {
  /** `atras`: «← Volver a Cargas» de arriba. `salida`: botón secundario de un estado. `enlace`: dentro de un banner. */
  variante: 'atras' | 'salida' | 'enlace';
}

/** Enlace a `/cargas`; siempre un `<a>` real. */
export function EnlaceCargas({ variante }: EnlaceCargasProps) {
  return (
    <Link className={estilos[variante]} to="/cargas">
      {variante === 'atras' ? (
        <>
          <span aria-hidden="true">← </span>
          {VOLVER_A_CARGAS}
        </>
      ) : (
        VOLVER_A_CARGAS
      )}
    </Link>
  );
}
