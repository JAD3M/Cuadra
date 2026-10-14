import { createContext, useContext } from 'react';
import type { AccionesPlataforma, EstadoPlataforma } from './tipos';

export const ContextoEstadoPlataforma = createContext<EstadoPlataforma | null>(
  null,
);
export const ContextoAccionesPlataforma =
  createContext<AccionesPlataforma | null>(null);

/** Estado de la sesión de plataforma. Falla fuera de su proveedor. */
export function useSesionPlataforma(): EstadoPlataforma {
  const estado = useContext(ContextoEstadoPlataforma);
  if (estado === null) {
    throw new Error(
      'useSesionPlataforma debe usarse dentro de SesionPlataformaProvider.',
    );
  }
  return estado;
}

/** Acciones de la sesión de plataforma. Falla sin proveedor o de solo lectura. */
export function useAccionesPlataforma(): AccionesPlataforma {
  const acciones = useContext(ContextoAccionesPlataforma);
  if (acciones === null) {
    throw new Error(
      'useAccionesPlataforma debe usarse dentro de SesionPlataformaProvider.',
    );
  }
  return acciones;
}
