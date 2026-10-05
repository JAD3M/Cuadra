import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessionContext } from '@/shared/sesion';
import { origenDe } from './origen';

/**
 * Guarda de las rutas internas (layout sin ruta propia). La sesión decide:
 *
 * - `ready`, `loading`, `unavailable`: deja pasar; `ShellLayout` dibuja cada
 *   uno. Con un cambio de empresa en curso (`selecting` con origen `cambio`)
 *   la sesión sigue viva y también deja pasar.
 * - `anonymous`: a `/login`, recordando la pantalla pedida.
 * - `ended`: a `/login`; la pantalla pedida solo se recuerda si la sesión
 *   expiró (`sesion_expirada`). Cerrar sesión o perder el acceso no.
 * - `selecting` de un login: a `/empresa`, sin atajos al shell.
 *
 * Las redirecciones reemplazan la entrada del historial: Atrás no vuelve a
 * una pantalla a la que no se puede estar.
 */
export function RutaProtegida() {
  const sesion = useSessionContext();
  const ubicacion = useLocation();

  switch (sesion.status) {
    case 'ready':
    case 'loading':
    case 'unavailable':
      return <Outlet />;
    case 'selecting': {
      if (sesion.origen === 'cambio') return <Outlet />;
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
