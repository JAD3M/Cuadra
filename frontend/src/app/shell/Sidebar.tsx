import type { ReactNode } from 'react';
import type { Permiso, Rol } from '@/shared/dominio';
import { elementoActivo, elementosVisibles } from './navegacion';
import { NavItem } from './NavItem';
import { UserBlock } from './UserBlock';
import estilos from './Sidebar.module.css';

export interface SidebarProps {
  /** Ruta actual (`pathname`); decide el elemento activo. */
  rutaActual: string;
  /** Pendientes de la bandeja; ausente = sin contador. */
  pendientes?: number;
  usuario: { nombre: string };
  roles: readonly Rol[];
  /** Capacidades de la sesión: deciden qué enlaces se dibujan. */
  capacidades: readonly Permiso[];
  /** Control de tema; se dibuja justo encima del bloque de usuario. */
  controlTema: ReactNode;
  /** Cierra la sesión desde el bloque de usuario; ausente = sin botón. */
  onCerrarSesion?: () => void;
}

/** Barra lateral: marca, navegación principal, control de tema y usuario. */
export function Sidebar({
  rutaActual,
  pendientes,
  usuario,
  roles,
  capacidades,
  controlTema,
  onCerrarSesion,
}: SidebarProps) {
  const activo = elementoActivo(rutaActual);
  return (
    <aside className={estilos.barra} aria-label="Barra lateral">
      <div className={estilos.marca}>
        <svg
          width="28"
          height="28"
          viewBox="0 0 36 36"
          fill="none"
          strokeWidth="2.5"
          className={estilos.logo}
          aria-hidden="true"
          focusable="false"
        >
          <rect x="3" y="3" width="30" height="30" rx="8" />
          <path d="M11 18l5 5 9-11" />
        </svg>
        <span className={estilos.nombreMarca}>Cuadra</span>
      </div>
      <nav className={estilos.nav} aria-label="Navegación principal">
        {elementosVisibles(capacidades).map((elemento) => (
          <NavItem
            key={elemento.clave}
            elemento={elemento}
            activo={elemento === activo}
            pendientes={elemento.clave === 'bandeja' ? pendientes : undefined}
          />
        ))}
      </nav>
      <div className={estilos.pie}>
        {controlTema}
        <UserBlock
          nombre={usuario.nombre}
          roles={roles}
          onCerrarSesion={onCerrarSesion}
        />
      </div>
    </aside>
  );
}
