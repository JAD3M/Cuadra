import type { Rol } from '../common/entities/tipos';

export type Scope = 'seleccion' | 'sesion';

/** Lo que va firmado dentro del JWT. Mínimo: identidad, no permisos. */
export type JwtPayload =
  | {
      sub: string; // user_id
      scope: 'seleccion';
      companyId?: never;
    }
  | {
      sub: string;
      scope: 'sesion';
      companyId: string;
    };

/** Lo que la JwtStrategy deja en request.user. */
export type UsuarioAutenticado =
  | {
      userId: string;
      scope: 'seleccion';
      companyId?: never;
    }
  | {
      userId: string;
      scope: 'sesion';
      companyId: string;
    };

/** Lo único del usuario que sale por la API: nunca el hash de la contraseña. */
export interface UsuarioPublico {
  id: string;
  nombre: string;
  email: string;
}

export interface EmpresaDisponible {
  id: string;
  razonSocial: string;
  rfc: string;
  /** En orden fijo: admin, contador, revisor. */
  roles: Rol[];
}
