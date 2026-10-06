import { FilaPropuesta, type PropuestaFila } from './FilaPropuesta';
import estilos from './ListaPropuestas.module.css';

export type { PropuestaFila } from './FilaPropuesta';

export interface ListaPropuestasProps {
  /** Todas las propuestas en el orden del servidor. */
  propuestas: readonly PropuestaFila[];
  /** La propuesta expandida: no aparece en la lista de colapsadas. */
  seleccionadaId: string;
  onSeleccionar: (conciliacionId: string) => void;
}

/**
 * Las propuestas colapsadas, en el orden del servidor y sin la expandida. Con
 * una sola propuesta (la expandida) no hay nada que listar.
 */
export function ListaPropuestas({
  propuestas,
  seleccionadaId,
  onSeleccionar,
}: ListaPropuestasProps) {
  const colapsadas = propuestas.filter(
    (p) => p.conciliacionId !== seleccionadaId,
  );
  if (colapsadas.length === 0) return null;
  return (
    <ul className={estilos.lista}>
      {colapsadas.map((propuesta) => (
        <FilaPropuesta
          key={propuesta.conciliacionId}
          propuesta={propuesta}
          onSeleccionar={onSeleccionar}
        />
      ))}
    </ul>
  );
}
