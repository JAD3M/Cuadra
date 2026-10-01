import { useContext } from 'react';
import { ContextoEstadoSesion } from './contexto';
import type { SessionState } from './types';

/** Estado de la sesión. Falla si no hay un proveedor de sesión montado. */
export function useSessionContext(): SessionState {
  const estado = useContext(ContextoEstadoSesion);
  if (estado === null) {
    throw new Error(
      'useSessionContext debe usarse dentro de un proveedor de sesión.',
    );
  }
  return estado;
}
