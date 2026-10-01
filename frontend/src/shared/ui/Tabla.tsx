import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import estilos from './Tabla.module.css';

export interface TablaProps {
  /** Nombre accesible de la tabla. Se publica como `<caption>` oculto. */
  titulo: string;
  /** `thead` y `tbody` con sus filas, escritos con marcado nativo. */
  children: ReactNode;
}

/**
 * Cascarón de tabla semántica. El envoltorio hace scroll horizontal y es
 * enfocable para que el teclado pueda desplazarlo cuando hay desborde.
 */
export function Tabla({ titulo, children }: TablaProps) {
  return (
    <div
      className={estilos.envoltorio}
      role="region"
      aria-label={titulo}
      tabIndex={0}
    >
      <table className={estilos.tabla}>
        <caption className={estilos.ocultoVisual}>{titulo}</caption>
        {children}
      </table>
    </div>
  );
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Columna de montos: alineada al final, sin partir y del tamaño del contenido. */
  numerica?: boolean;
}

/** Celda de encabezado. Por omisión describe una columna (`scope="col"`). */
export function Th({
  numerica = false,
  scope = 'col',
  className,
  ...resto
}: ThProps) {
  const clases = [estilos.th, numerica ? estilos.numerica : '', className]
    .filter(Boolean)
    .join(' ');
  return <th {...resto} scope={scope} className={clases} />;
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Columna de montos: alineada al final, sin partir y del tamaño del contenido. */
  numerica?: boolean;
}

/** Celda de datos. Con `numerica` nunca parte el monto que contiene. */
export function Td({ numerica = false, className, ...resto }: TdProps) {
  const clases = [estilos.td, numerica ? estilos.numerica : '', className]
    .filter(Boolean)
    .join(' ');
  return <td {...resto} className={clases} />;
}
