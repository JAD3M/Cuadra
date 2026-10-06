import { useState } from 'react';
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
 *   pantalla, pero solo si la época no cambió: si se eligió otra empresa y el
 *   contexto llega antes de que el enrutador termine de ir a `/bandeja`, el
 *   `ready` no debe devolver a la pantalla anterior.
 */
export function RutaSeleccion() {
  const sesion = useSessionContext();
  const { state } = useLocation();
  // Época de la sesión mientras se elige empresa. Esta guarda sigue montada
  // cuando la sesión pasa de `selecting` a `loading` y `ready`, así que sirve
  // para saber si en `ready` se eligió otra empresa (la época cambió) o se
  // abandonó el cambio (la misma época).
  const [epocaAlElegir, setEpocaAlElegir] = useState<number | null>(null);
  if (
    sesion.status === 'selecting' &&
    sesion.epoca !== undefined &&
    sesion.epoca !== epocaAlElegir
  ) {
    setEpocaAlElegir(sesion.epoca);
  }

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
      // Si se eligió otra empresa, `volverA` ya no aplica: el destino es el
      // de un acceso nuevo, igual que en `loading`. El enrutador puede no
      // haber salido aún de `/empresa` cuando el contexto llega.
      const abandonoElCambio =
        epocaAlElegir === null || epocaAlElegir === sesion.epoca;
      const volverA = abandonoElCambio
        ? estadoAcceso(state).volverA
        : undefined;
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
