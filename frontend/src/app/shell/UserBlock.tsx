import { ETIQUETAS_ROL, ordenarRoles, type Rol } from '@/shared/dominio';
import estilos from './UserBlock.module.css';

export interface UserBlockProps {
  nombre: string;
  roles: readonly Rol[];
  /** Cierra la sesión; ausente = sin botón. El servidor cancela la sesión; la pantalla no lo explica. */
  onCerrarSesion?: () => void;
}

/**
 * Nombre del usuario y sus roles, siempre en el orden fijo de `ROLES`, y el
 * botón «Cerrar sesión» cuando se pasa `onCerrarSesion`.
 */
export function UserBlock({ nombre, roles, onCerrarSesion }: UserBlockProps) {
  const etiquetas = ordenarRoles(roles).map((rol) => ETIQUETAS_ROL[rol]);
  return (
    <div className={estilos.bloque}>
      <span className={estilos.nombre}>{nombre}</span>
      {etiquetas.length > 0 && (
        <span className={estilos.roles}>{etiquetas.join(', ')}</span>
      )}
      {onCerrarSesion && (
        <button
          type="button"
          className={estilos.cerrar}
          onClick={onCerrarSesion}
        >
          Cerrar sesión
        </button>
      )}
    </div>
  );
}
