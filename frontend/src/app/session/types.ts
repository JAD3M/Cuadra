import type { ContextoSesion } from '@/shared/api/contratos';

/** Contexto de la sesión activa: usuario, empresa y roles (`/auth/contexto`). */
export type SessionContext = ContextoSesion;

/**
 * Estado de la sesión que consume el shell.
 * - `loading`: todavía no se conoce el contexto.
 * - `ready`: hay usuario, empresa y roles.
 * - `ended`: la sesión terminó; CU-21 decide qué hacer (redirigir, etc.).
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; contexto: SessionContext }
  | { status: 'ended' };
