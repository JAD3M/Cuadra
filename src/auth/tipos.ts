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

export interface EmpresaDisponible {
  id: string;
  razonSocial: string;
}
