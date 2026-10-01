import { createContext } from 'react';
import type { SessionState } from './types';

/** `null` significa que no hay proveedor montado: el hook lo trata como error. */
export const ContextoEstadoSesion = createContext<SessionState | null>(null);
