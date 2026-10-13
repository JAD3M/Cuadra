import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  LLAVE_PUBLICO,
  LLAVE_SCOPE,
  type SolicitudAutenticada,
} from '../../common/decorators/decoradores';
import {
  COOKIE_SESION,
  fijarCookieSesion,
  SesionesService,
} from '../sesiones.service';
import type { Scope, UsuarioAutenticado } from '../tipos';

/** Un solo mensaje para todo: no decimos si faltó, venció o era de otro tipo. */
const NO_AUTORIZADO = 'No autorizado';

/**
 * Guard global (AD-6). Lee la cookie de sesión, la busca en `sesiones`, la
 * renueva y vuelve a emitir la cookie con `Max-Age` nuevo en cada petición
 * autenticada. Deja en `request.user` un `UsuarioAutenticado`: sin empresa
 * elegida es scope 'seleccion'; con empresa, 'sesion'.
 */
@Injectable()
export class SesionCookieGuard implements CanActivate {
  constructor(
    private readonly sesiones: SesionesService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(LLAVE_PUBLICO, destinos)) {
      return true;
    }
    const scopesAceptados = this.reflector.getAllAndOverride<Scope[]>(
      LLAVE_SCOPE,
      destinos,
    ) ?? ['sesion'];

    const http = contexto.switchToHttp();
    const solicitud = http.getRequest<Request>();
    const token = leerCookie(solicitud);
    if (!token) throw new UnauthorizedException(NO_AUTORIZADO);

    const sesion = await this.sesiones.buscarPorToken(token);
    // `plataforma` llega con la historia 1.3; hasta entonces no opera aquí.
    if (!sesion || sesion.tipo !== 'empresa' || sesion.userId === null) {
      throw new UnauthorizedException(NO_AUTORIZADO);
    }
    const userId = sesion.userId;
    const usuario: UsuarioAutenticado =
      sesion.companyId === null
        ? { userId, scope: 'seleccion', sesionId: sesion.id }
        : {
            userId,
            scope: 'sesion',
            companyId: sesion.companyId,
            sesionId: sesion.id,
          };
    if (!scopesAceptados.includes(usuario.scope)) {
      throw new UnauthorizedException(NO_AUTORIZADO);
    }
    if (!(await this.sesiones.renovar(sesion.id))) {
      throw new UnauthorizedException(NO_AUTORIZADO);
    }
    fijarCookieSesion(http.getResponse<Response>(), token);
    (solicitud as SolicitudAutenticada).user = usuario;
    return true;
  }
}

/** Valor de la cookie de sesión si viene y es texto; si no, null. */
export function leerCookie(solicitud: Request): string | null {
  const cookies = solicitud.cookies as Record<string, unknown> | undefined;
  const valor = cookies?.[COOKIE_SESION];
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}
