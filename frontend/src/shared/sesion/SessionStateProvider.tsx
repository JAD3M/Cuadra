import type { ReactNode } from 'react';
import { ContextoEstadoSesion } from './contextos';
import type { SessionState } from './tipos';

export interface SessionStateProviderProps {
  estado: SessionState;
  children: ReactNode;
}

/**
 * Proveedor genérico: publica un estado ya resuelto. El proveedor real de
 * CU-21 calculará `estado` desde `/auth/contexto` y se montará en su lugar.
 */
export function SessionStateProvider({
  estado,
  children,
}: SessionStateProviderProps) {
  return (
    <ContextoEstadoSesion.Provider value={estado}>
      {children}
    </ContextoEstadoSesion.Provider>
  );
}
