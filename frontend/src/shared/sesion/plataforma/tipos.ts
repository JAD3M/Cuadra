import type { UsuarioPlataforma } from '@/shared/api/contratos/plataforma';

/** Por qué terminó la sesión de plataforma; decide el aviso del acceso. */
export type MotivoFinPlataforma = 'sesion_terminada' | 'sesion_cerrada';

/**
 * Estado público de la sesión de plataforma. Es independiente del de empresa:
 * no tiene empresa, ni roles, ni elección de empresa, y nunca incluye token.
 *
 * - `restoring`: arranque o recarga; se pregunta al servidor si la cookie vale.
 * - `anonymous`: no hay sesión (o la cookie es de otro mundo).
 * - `ready`: sesión viva del dueño.
 * - `ended`: la sesión terminó por `motivo`; el acceso lo muestra una vez.
 */
export type EstadoPlataforma =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'ready'; usuario: UsuarioPlataforma }
  | { status: 'ended'; motivo: MotivoFinPlataforma };

export interface CredencialesPlataforma {
  email: string;
  password: string;
}

export interface AccionesPlataforma {
  /** `POST /plataforma/auth/login`. Rechaza con el error de la API. */
  iniciarSesion(credenciales: CredencialesPlataforma): Promise<void>;
  /** `POST /plataforma/auth/logout` (idempotente) y fin de la sesión. */
  cerrarSesion(): Promise<void>;
  /** La API dijo que la sesión ya no vale (401 en una llamada de la sesión). */
  terminar(): void;
  /** El acceso ya mostró el aviso: la sesión pasa a `anonymous`. */
  consumirFin(): void;
}
