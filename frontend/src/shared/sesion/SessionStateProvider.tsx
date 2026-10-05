import type { ReactNode } from 'react';
import { ContextoAccionesSesion, ContextoEstadoSesion } from './contextos';
import type { AccionesSesion, SessionState } from './tipos';

export interface SessionStateProviderProps {
  estado: SessionState;
  /** Sin acciones, `useSessionActions` falla: es un proveedor de solo lectura. */
  acciones?: AccionesSesion;
  children: ReactNode;
}

/**
 * Proveedor genérico: publica un estado ya resuelto (pruebas, previsualización
 * y el proveedor provisional). `SessionProvider` lo usa para publicar el
 * estado real junto con las acciones.
 */
export function SessionStateProvider({
  estado,
  acciones,
  children,
}: SessionStateProviderProps) {
  return (
    <ContextoEstadoSesion.Provider value={estado}>
      <ContextoAccionesSesion.Provider value={acciones ?? null}>
        {children}
      </ContextoAccionesSesion.Provider>
    </ContextoEstadoSesion.Provider>
  );
}
