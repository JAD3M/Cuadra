import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import {
  LLAVE_PUBLICO,
  LLAVE_SCOPE,
  type SolicitudAutenticada,
} from '../decoradores';
import type { JwtPayload, UsuarioAutenticado } from '../tipos';

/** Un solo mensaje para todo: no decimos si faltó, expiró o era de otro tipo. */
const NO_AUTORIZADO = 'No autorizado';

/**
 * Guard global. Verifica el Bearer con `JwtService` (sin Passport) y deja en
 * `request.user` un `UsuarioAutenticado` según el scope del token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(LLAVE_PUBLICO, destinos)) {
      return true;
    }
    const scopeRequerido =
      this.reflector.getAllAndOverride<JwtPayload['scope']>(
        LLAVE_SCOPE,
        destinos,
      ) ?? 'sesion';

    const solicitud = contexto.switchToHttp().getRequest<Request>();
    const token = extraerBearer(solicitud);
    if (!token) throw new UnauthorizedException(NO_AUTORIZADO);

    let crudo: unknown;
    try {
      crudo = await this.jwtService.verifyAsync<object>(token, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException(NO_AUTORIZADO);
    }

    const usuario = aUsuarioAutenticado(crudo);
    if (!usuario || usuario.scope !== scopeRequerido) {
      throw new UnauthorizedException(NO_AUTORIZADO);
    }
    (solicitud as SolicitudAutenticada).user = usuario;
    return true;
  }
}

function extraerBearer(solicitud: Request): string | null {
  const [tipo, token] = solicitud.headers.authorization?.split(' ') ?? [];
  return tipo === 'Bearer' && token ? token : null;
}

/**
 * La firma prueba quién emitió el token, no que tenga la forma esperada. Se
 * valida aquí para que el resto del código pueda confiar en la unión de tipos.
 * Un token sin `exp` se rechaza aunque la firma sea válida: `jsonwebtoken` lo
 * aceptaría para siempre (D-09).
 */
function aUsuarioAutenticado(crudo: unknown): UsuarioAutenticado | null {
  if (typeof crudo !== 'object' || crudo === null) return null;
  const { sub, scope, companyId, exp } = crudo as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof exp !== 'number') return null;

  if (scope === 'seleccion' && companyId === undefined) {
    return { userId: sub, scope };
  }
  if (scope === 'sesion' && typeof companyId === 'string') {
    return { userId: sub, scope, companyId };
  }
  return null;
}
