import { createContext } from 'react';
import type { AccionesSesion, SessionState } from './tipos';

/** `null` significa que no hay proveedor montado: el hook lo trata como error. */
export const ContextoEstadoSesion = createContext<SessionState | null>(null);

/** Acciones de sesión (identidad estable). `null` si no hay proveedor. */
export const ContextoAccionesSesion = createContext<AccionesSesion | null>(
  null,
);
