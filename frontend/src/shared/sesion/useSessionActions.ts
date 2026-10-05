import { useContext } from 'react';
import { ContextoAccionesSesion } from './contextos';
import type { AccionesSesion } from './tipos';

/** Acciones de la sesión. Falla si no hay un proveedor de sesión real. */
export function useSessionActions(): AccionesSesion {
  const acciones = useContext(ContextoAccionesSesion);
  if (acciones === null) {
    throw new Error(
      'useSessionActions debe usarse dentro de un proveedor de sesión.',
    );
  }
  return acciones;
}
