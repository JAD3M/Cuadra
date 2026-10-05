import { useContext } from 'react';
import { ContextoAccionesSesion } from './contextos';
import type { AccionesSesion } from './tipos';

/**
 * Acciones de la sesión, o `null` si el proveedor es de solo lectura (la
 * sesión provisional de CU-20). Solo para contenedores que deben seguir
 * funcionando con ese proveedor; el resto usa `useSessionActions`.
 */
export function useSessionActionsOpcional(): AccionesSesion | null {
  return useContext(ContextoAccionesSesion);
}
