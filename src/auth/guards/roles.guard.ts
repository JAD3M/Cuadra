import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../../common/entities/tipos';
import type { Scope } from '../tipos';
import { AccesosDenegados } from '../../bitacora/accesos-denegados';
import { AuthService } from '../auth.service';
import {
  LLAVE_PUBLICO,
  LLAVE_ROLES,
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
    // Un endpoint que acepta la sesión sin empresa (elegir o cambiar de
    // empresa) no opera sobre la actual: no exige membresía en ella.
    const scopes = this.reflector.getAllAndOverride<Scope[] | undefined>(
      LLAVE_SCOPE,
      destinos,
    );
    if (scopes?.includes('seleccion')) return true;

    // Aun sin @Roles, una sesión exige membresía vigente en su empresa.
    const roles = await this.authService.rolesEnEmpresa(
      user.userId,
      user.companyId,
    );
    const requeridos =
      this.reflector.getAllAndOverride<Rol[] | undefined>(
        LLAVE_ROLES,
        destinos,
      ) ?? [];
    const denegar = async (mensaje: string): Promise<never> => {
      await this.accesosDenegados.registrar({
        companyId: user.companyId,
        userId: user.userId,
        metodo: solicitud.method,
        ruta: solicitud.path,
        rolesRequeridos: requeridos,
        rolesDelUsuario: roles,
        ip: solicitud.ip,
        userAgent: solicitud.headers?.['user-agent'],
      });
      throw new ForbiddenException(mensaje);
    };

    if (roles.length === 0) return denegar('Sin acceso a esta empresa');
    if (!requeridos.length) return true;
    // D-08: basta con que uno de sus roles alcance.
    if (roles.some((rol) => requeridos.includes(rol))) return true;
    return denegar('Rol insuficiente');
  }
}
