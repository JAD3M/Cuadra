import { Navigate, Outlet } from 'react-router';
import { useSesionPlataforma } from '@/shared/sesion/plataforma';

/**
 * Guarda de `/plataforma/login`: solo se ve sin sesión de plataforma.
 *
 * - `restoring`: nada, hasta saber si la cookie todavía vale.
 * - `anonymous`, `ended`: muestra la pantalla de acceso.
 * - `ready`: ya hay sesión; va a `/plataforma`.
 */
export function RutaAnonimaPlataforma() {
  const sesion = useSesionPlataforma();

  switch (sesion.status) {
    case 'restoring':
      return null;
    case 'anonymous':
    case 'ended':
      return <Outlet />;
    case 'ready':
      return <Navigate to="/plataforma" replace />;
  }
}
