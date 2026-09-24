import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../../common/entities/tipos';
import { AuthService } from '../auth.service';
import {
  LLAVE_PUBLICO,
  LLAVE_ROLES,
  type SolicitudAutenticada,
} from '../../common/decorators/decoradores';

/**
 * Guard global, corre después de `JwtAuthGuard`. Los roles no viajan en el
 * token (D-09): se leen de `user_company_roles` en cada request, así que
 * revocar un rol o una membresía surte efecto de inmediato.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(LLAVE_PUBLICO, destinos)) {
      return true;
    }
    const { user } = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    // El token de selección no opera sobre ninguna empresa: no hay roles que revisar.
    if (user.scope !== 'sesion') return true;

    // Aun sin @Roles, una sesión exige membresía vigente en su empresa.
    const roles = await this.authService.rolesEnEmpresa(
      user.userId,
      user.companyId,
    );
    if (roles.length === 0) {
      throw new ForbiddenException('Sin acceso a esta empresa');
    }

    const requeridos = this.reflector.getAllAndOverride<Rol[] | undefined>(
      LLAVE_ROLES,
      destinos,
    );
    if (!requeridos?.length) return true;
    // D-08: basta con que uno de sus roles alcance.
    if (roles.some((rol) => requeridos.includes(rol))) return true;
    throw new ForbiddenException('Rol insuficiente');
  }
}
