import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { destinoSeguro, useSessionContext } from '@/shared/sesion';
import { origenDe } from './origen';

/**
 * Guarda de las rutas internas (layout sin ruta propia). La sesión decide:
 *
 * - `ready`, `restoring`, `loading`, `unavailable`: deja pasar; `ShellLayout` dibuja cada
 *   uno.
 * - `selecting` con origen `cambio` (cambio de empresa en curso): la sesión
 *   sigue viva, pero la ruta interna redirige a `/empresa` con la
 *   pantalla actual como `volverA` (solo en el estado del enrutador).
 * - `anonymous`: a `/login`, recordando la pantalla pedida.
 * - `ended`: a `/login`; la pantalla pedida solo se recuerda si la sesión
 *   expiró (`sesion_expirada`). Cerrar sesión o perder el acceso no.
 * - `selecting` de un login: a `/empresa`, sin atajos al shell.
 *
 * Las redirecciones reemplazan la entrada del historial (Atrás no vuelve a
 * una pantalla a la que no se puede estar). La única excepción es el inicio de
 * un cambio de empresa estando en una ruta interna: ahí se agrega la entrada
 * de `/empresa` y la pantalla de origen queda atrás en el historial.
 */
export function RutaProtegida() {
  const sesion = useSessionContext();
  const ubicacion = useLocation();
  // La guarda se monta de nuevo cada vez que se llega a una ruta interna.
  // Si ya llegó con un cambio en curso (Atrás desde `/empresa`, un enlace) la
  // entrada se reemplaza; si el cambio empieza estando aquí, se agrega la de
  // `/empresa` y la pantalla de origen sigue en el historial para Atrás.
  const [llegoEnCambio] = useState(
    () => sesion.status === 'selecting' && sesion.origen === 'cambio',
  );

  switch (sesion.status) {
    case 'ready':
    case 'restoring':
    case 'loading':
    case 'unavailable':
      return <Outlet />;
    case 'selecting': {
      if (sesion.origen === 'cambio') {
        // Con un cambio en curso la sesión sigue viva, pero la pantalla de
        // elección es la única válida: cualquier ruta interna (por ejemplo,
        // tras Atrás desde `/empresa`) vuelve a ella y conserva la pantalla
        // actual como destino de retorno.
        const volverA = destinoSeguro(ubicacion);
        return (
          <Navigate
            to="/empresa"
            replace={llegoEnCambio}
            state={volverA ? { volverA } : undefined}
          />
        );
      }
      const from = origenDe(ubicacion);
      return (
        <Navigate to="/empresa" replace state={from ? { from } : undefined} />
      );
    }
    case 'anonymous': {
      const from = origenDe(ubicacion);
      return (
        <Navigate to="/login" replace state={from ? { from } : undefined} />
      );
    }
    case 'ended': {
      const from =
        sesion.motivo === 'sesion_expirada' ? origenDe(ubicacion) : null;
      return (
        <Navigate to="/login" replace state={from ? { from } : undefined} />
      );
    }
  }
}
