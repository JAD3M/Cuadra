import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Scope } from '../tipos';
import { AccesosDenegados } from '../../bitacora/accesos-denegados';
import { AuthService } from '../auth.service';
import { type PermisoEmpresa, rolesConPermiso } from '../permisos/matriz';
import {
  LLAVE_PUBLICO,
  LLAVE_PERMISO,
  LLAVE_SCOPE,
  type SolicitudAutenticada,
} from '../../common/decorators/decoradores';

/**
 * Guard global, corre después de `SesionCookieGuard`. Los roles no viajan en
 * la sesión (AD-6): se leen de `user_company_roles` en cada request, así que
 * revocar un rol o una membresía surte efecto de inmediato.
 *
 * Cada 403 queda en la bitácora de la empresa (CU-03.3).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly accesosDenegados: AccesosDenegados,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(LLAVE_PUBLICO, destinos)) {
      return true;
    }
    const solicitud = contexto
      .switchToHttp()
      .getRequest<SolicitudAutenticada>();
    const { user } = solicitud;
    // La sesión sin empresa elegida no opera sobre ninguna: no hay roles que revisar.
    if (user.scope !== 'sesion') return true;
    const scopes = this.reflector.getAllAndOverride<Scope[] | undefined>(
      LLAVE_SCOPE,
      destinos,
    );
    const permiso = this.reflector.getAllAndOverride<
      PermisoEmpresa | undefined
    >(LLAVE_PERMISO, destinos);
    const requeridos = permiso === undefined ? [] : rolesConPermiso(permiso);
    // Un endpoint que acepta la sesión sin empresa (elegir o cambiar de
    // empresa) no opera sobre la actual: no exige membresía en ella, para que
    // quien perdió su rol pueda salir. Solo vale si no declara @Permiso: si
    // lo declara, opera sobre la empresa y sigue el camino normal.
    const noOperaSobreLaEmpresa =
      scopes?.includes('seleccion') === true && permiso === undefined;
    if (noOperaSobreLaEmpresa) return true;

    // Aun sin @Permiso, una sesión exige membresía vigente en su empresa.
    const roles = await this.authService.rolesEnEmpresa(
      user.userId,
      user.companyId,
    );
    const denegar = async (mensaje: string): Promise<never> => {
      await this.accesosDenegados.registrar({
        companyId: user.companyId,
        userId: user.userId,
        metodo: solicitud.method,
        ruta: solicitud.path,
        rolesRequeridos: [...requeridos],
        permiso,
        rolesDelUsuario: roles,
        ip: solicitud.ip,
        userAgent: solicitud.headers?.['user-agent'],
      });
      throw new ForbiddenException(mensaje);
    };

    if (roles.length === 0) return denegar('Sin acceso a esta empresa');
    if (permiso === undefined) return true;
    // D-08: basta con que uno de sus roles tenga el permiso.
    if (roles.some((rol) => requeridos.includes(rol))) return true;
    return denegar('Rol insuficiente');
  }
}
