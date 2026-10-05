import { Navigate, Outlet, useLocation } from 'react-router';
import {
  destinoTrasAcceso,
  estadoAcceso,
  useSessionContext,
} from '@/shared/sesion';

/**
 * Guarda de `/login`: solo se ve sin sesión.
 *
 * - `anonymous`, `ended`: muestra la pantalla de acceso.
 * - `selecting`: a `/empresa`, conservando el destino ya validado.
 * - `loading`, `ready`, `unavailable`: ya hay sesión; va al destino guardado
 *   (solo si la sesión permite restaurarlo) o a `/bandeja`.
 */
export function RutaAnonima() {
  const sesion = useSessionContext();
  const { state } = useLocation();

  switch (sesion.status) {
    case 'anonymous':
    case 'ended':
      return <Outlet />;
    case 'selecting': {
      const { from } = estadoAcceso(state);
      return (
        <Navigate to="/empresa" replace state={from ? { from } : undefined} />
      );
    }
    case 'loading':
    case 'ready':
      return (
        <Navigate
          to={destinoTrasAcceso(state, {
            restaurarOrigen: sesion.restaurarOrigen,
          })}
          replace
        />
      );
    case 'unavailable':
      return (
        <Navigate
          to={destinoTrasAcceso(state, { restaurarOrigen: false })}
          replace
        />
      );
  }
}
