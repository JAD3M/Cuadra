import { Navigate, Outlet, useLocation } from 'react-router';
import {
  destinoDeRegreso,
  destinoTrasAcceso,
  estadoAcceso,
  useSessionContext,
} from '@/shared/sesion';

/**
 * Guarda de `/empresa`: solo se ve mientras se elige empresa.
 *
 * - `selecting` (de un login o de un cambio de empresa): muestra el paso.
 * - `anonymous`, `ended`: a `/login` con el foco en el correo. El destino
 *   guardado sigue su camino solo si la sesión anterior expiró o nunca hubo.
 * - `loading`, `ready`, `unavailable`: ya se eligió; va al destino guardado
 *   si la sesión permite restaurarlo (misma empresa tras una expiración) o
 *   a `/bandeja` (empresa distinta o cambio de empresa). Excepción: un
 *   `ready` que llega con `volverA` (abandono de un cambio) regresa a esa
 *   pantalla.
 */
export function RutaSeleccion() {
  const sesion = useSessionContext();
  const { state } = useLocation();

  switch (sesion.status) {
    case 'selecting':
      return <Outlet />;
    case 'anonymous':
      return (
        <Navigate
          to="/login"
          replace
          state={{ ...conDestino(state), foco: 'correo' }}
        />
      );
    case 'ended':
      return (
        <Navigate
          to="/login"
          replace
          state={{
            ...(sesion.motivo === 'sesion_expirada' ? conDestino(state) : {}),
            foco: 'correo',
          }}
        />
      );
    case 'ready': {
      // Volver a `ready` estando en `/empresa` solo ocurre al abandonar un
      // cambio (o al re-elegir la empresa activa): se regresa a la pantalla
      // que se dejó. Elegir otra empresa pasa antes por `loading`.
      const { volverA } = estadoAcceso(state);
      return (
        <Navigate
          to={
            volverA
              ? destinoDeRegreso(state)
              : destinoTrasAcceso(state, {
                  restaurarOrigen: sesion.restaurarOrigen,
                })
          }
          replace
        />
      );
    }
    case 'loading':
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

function conDestino(state: unknown) {
  const { from } = estadoAcceso(state);
  return from ? { from } : {};
}
