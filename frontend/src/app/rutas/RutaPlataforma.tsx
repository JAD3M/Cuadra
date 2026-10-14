import { Navigate, Outlet } from 'react-router';
import { useSesionPlataforma } from '@/shared/sesion/plataforma';

/**
 * Guarda de `/plataforma` (layout sin ruta propia). Decide solo por la sesión
 * de plataforma, nunca por la de empresa:
 *
 * - `restoring`: nada, hasta saber si la cookie todavía vale.
 * - `ready`: deja pasar.
 * - `anonymous`, `ended`: a `/plataforma/login`, reemplazando la entrada del
 *   historial. No recuerda la pantalla pedida: solo hay una.
 */
export function RutaPlataforma() {
  const sesion = useSesionPlataforma();

  switch (sesion.status) {
    case 'restoring':
      return null;
    case 'ready':
      return <Outlet />;
    case 'anonymous':
    case 'ended':
      return <Navigate to="/plataforma/login" replace />;
  }
}
