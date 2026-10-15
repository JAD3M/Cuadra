import type { Rol } from '../common/entities/tipos';
import type { PermisoEmpresa } from './permisos/matriz';

/** Tipo de sesión; ver `@Scope` en `decoradores.ts` para su semántica. */
export type Scope = 'seleccion' | 'sesion' | 'plataforma';

/**
 * Lo que el guard de sesión deja en request.user (AD-6). Identidad, no
 * permisos: los roles se leen de la base en cada petición. 'seleccion' =
 * sesión sin empresa elegida (`company_id` nulo); 'sesion' = con empresa;
 * 'plataforma' = cuenta del dueño de Cuadra (AD-5): nunca tiene `userId` ni
 * `companyId`, así que no puede llegar a código de empresa sin estrecharse.
 */
export type UsuarioAutenticado =
  | {
      userId: string;
      scope: 'seleccion';
      /** Fila de `sesiones` de esta petición. */
      sesionId: string;
      companyId?: never;
      plataformaUsuarioId?: never;
    }
  | {
      userId: string;
      scope: 'sesion';
      sesionId: string;
      companyId: string;
      plataformaUsuarioId?: never;
    }
  | {
      scope: 'plataforma';
      sesionId: string;
      plataformaUsuarioId: string;
      userId?: never;
      companyId?: never;
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
  /** Permisos de la matriz que tiene alguno de sus roles (unión). */
  capacidades: PermisoEmpresa[];
}

/** Lo que devuelve el login: el token va a la cookie, nunca al cuerpo. */
export interface ResultadoLogin {
  token: string;
  usuario: UsuarioPublico;
  empresas: EmpresaDisponible[];
}
