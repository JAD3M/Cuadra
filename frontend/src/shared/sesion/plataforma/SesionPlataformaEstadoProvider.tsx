import type { ReactNode } from 'react';
import {
  ContextoAccionesPlataforma,
  ContextoEstadoPlataforma,
} from './contextos';
import type { AccionesPlataforma, EstadoPlataforma } from './tipos';

export interface SesionPlataformaEstadoProviderProps {
  estado: EstadoPlataforma;
  /** Sin acciones, `useAccionesPlataforma` falla: es de solo lectura. */
  acciones?: AccionesPlataforma;
  children: ReactNode;
}

/**
 * Publica un estado ya resuelto (pruebas). `SesionPlataformaProvider` lo usa
 * para publicar el estado real junto con las acciones.
 */
export function SesionPlataformaEstadoProvider({
  estado,
  acciones,
  children,
}: SesionPlataformaEstadoProviderProps) {
  return (
    <ContextoEstadoPlataforma.Provider value={estado}>
      <ContextoAccionesPlataforma.Provider value={acciones ?? null}>
        {children}
      </ContextoAccionesPlataforma.Provider>
    </ContextoEstadoPlataforma.Provider>
  );
}
