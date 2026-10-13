import type { Rol } from '../common/entities/tipos';

/** Tipo de sesión; ver `@Scope` en `decoradores.ts` para su semántica. */
export type Scope = 'seleccion' | 'sesion';

/**
 * Lo que el guard de sesión deja en request.user (AD-6). Identidad, no
 * permisos: los roles se leen de la base en cada petición. 'seleccion' =
 * sesión sin empresa elegida (`company_id` nulo); 'sesion' = con empresa.
 */
export type UsuarioAutenticado =
  | {
      userId: string;
      scope: 'seleccion';
      /** Fila de `sesiones` de esta petición. */
      sesionId: string;
      companyId?: never;
    }
  | {
      userId: string;
      scope: 'sesion';
      sesionId: string;
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

export interface EmpresaContexto {
  id: string;
  razonSocial: string;
  rfc: string;
}

/** Quién es, en qué empresa y con qué roles (sesión con empresa). */
export interface ContextoSesion {
  usuario: UsuarioPublico;
  empresa: EmpresaContexto;
  roles: Rol[];
}

/** Lo que devuelve el login: el token va a la cookie, nunca al cuerpo. */
export interface ResultadoLogin {
  token: string;
  usuario: UsuarioPublico;
  empresas: EmpresaDisponible[];
}
