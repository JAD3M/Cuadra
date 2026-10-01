import { Link } from 'react-router';
import { IconoNav } from './IconoNav';
import type { ElementoNav } from './navegacion';
import estilos from './NavItem.module.css';

export interface NavItemProps {
  elemento: ElementoNav;
  activo: boolean;
  /** Pendientes por revisar; ausente = sin contador. */
  pendientes?: number;
}

/** Enlace de navegación. El activo se expone con `aria-current="page"`. */
export function NavItem({ elemento, activo, pendientes }: NavItemProps) {
  const clases = activo ? `${estilos.item} ${estilos.activo}` : estilos.item;
  return (
    <Link
      to={elemento.ruta}
      className={clases}
      aria-current={activo ? 'page' : undefined}
    >
      <IconoNav icono={elemento.icono} />
      {elemento.etiqueta}{' '}
      {pendientes !== undefined && (
        <>
          <span className={estilos.contador} aria-hidden="true">
            {pendientes}
          </span>
          <span className={estilos.ocultoVisual}>
            {pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`}
          </span>
        </>
      )}
    </Link>
  );
}
