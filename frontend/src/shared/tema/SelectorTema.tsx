import { useId } from 'react';
import estilos from './SelectorTema.module.css';

export interface OpcionSelector<V extends string> {
  valor: V;
  etiqueta: string;
  /** Símbolo decorativo; el nombre accesible es solo la etiqueta. */
  glifo: string;
}

export interface SelectorTemaProps<V extends string> {
  /** Opción marcada. Debe ser el valor guardado, no el tema resuelto. */
  valor: V;
  opciones: readonly OpcionSelector<V>[];
  onCambiar: (valor: V) => void;
  /** Nombre accesible del grupo (leyenda oculta a la vista). */
  etiqueta?: string;
}

/**
 * Control segmentado de tema hecho con radios nativos dentro de un
 * `fieldset`: el navegador aporta la navegación con flechas y el orden de
 * tabulación. Es presentacional: no conoce el almacenamiento ni el tema real.
 * Cada opción es un objetivo táctil de 44 px aunque el segmento mida 36 px.
 */
export function SelectorTema<V extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta = 'Tema',
}: SelectorTemaProps<V>) {
  const grupo = useId();
  return (
    <fieldset className={estilos.grupo}>
      <legend className={estilos.leyenda}>{etiqueta}</legend>
      {opciones.map((opcion) => (
        <label key={opcion.valor} className={estilos.opcion}>
          <input
            type="radio"
            name={grupo}
            value={opcion.valor}
            checked={opcion.valor === valor}
            onChange={() => onCambiar(opcion.valor)}
            className={estilos.entrada}
          />
          <span className={estilos.segmento}>
            <span aria-hidden="true">{opcion.glifo}</span>
            {opcion.etiqueta}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
