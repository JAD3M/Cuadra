import type { ChangeEvent } from 'react';
import estilos from './SelectorArchivos.module.css';

export interface SelectorArchivosProps {
  /** Texto del botón: «Elegir archivos» o «Elegir archivo». */
  etiqueta: string;
  /** Pista para el selector del sistema; nunca se confía en ella. */
  accept: string;
  multiple?: boolean;
  deshabilitado?: boolean;
  /** `primario` para el XML (azul), `secundario` para el CSV (neutro). */
  variante?: 'primario' | 'secundario';
  /** Los archivos elegidos, en orden. Cada elección REEMPLAZA la anterior (M16). */
  onElegir: (archivos: File[]) => void;
}

/**
 * Botón de elegir archivos: una `<label>` con aspecto de botón que envuelve al
 * `input[type=file]`. El input queda fuera de la vista pero NO fuera del foco:
 * con el teclado se llega a él y la etiqueta pinta el anillo con
 * `:focus-within`. `getByLabelText` devuelve el input real.
 */
export function SelectorArchivos({
  etiqueta,
  accept,
  multiple = false,
  deshabilitado = false,
  variante = 'primario',
  onElegir,
}: SelectorArchivosProps) {
  function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.currentTarget.files ?? []);
    // Se limpia tras leer: sin esto, volver a elegir el MISMO archivo no
    // dispararía `change` y la selección no se podría rehacer.
    evento.currentTarget.value = '';
    onElegir(archivos);
  }

  return (
    <label
      className={`${estilos.selector} ${estilos[variante]}`}
      data-variante={variante}
      data-deshabilitado={deshabilitado}
    >
      {etiqueta}
      <input
        type="file"
        className="solo-lectores"
        accept={accept}
        multiple={multiple}
        disabled={deshabilitado}
        onChange={alElegir}
      />
    </label>
  );
}
