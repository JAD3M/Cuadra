import { ETIQUETAS_ROL, ordenarRoles, type Rol } from '@/shared/dominio';
import estilos from './UserBlock.module.css';

export interface UserBlockProps {
  nombre: string;
  roles: readonly Rol[];
}

/** Nombre del usuario y sus roles, siempre en el orden fijo de `ROLES`. */
export function UserBlock({ nombre, roles }: UserBlockProps) {
  const etiquetas = ordenarRoles(roles).map((rol) => ETIQUETAS_ROL[rol]);
  return (
    <div className={estilos.bloque}>
      <span className={estilos.nombre}>{nombre}</span>
      {etiquetas.length > 0 && (
        <span className={estilos.roles}>{etiquetas.join(', ')}</span>
      )}
    </div>
  );
}
