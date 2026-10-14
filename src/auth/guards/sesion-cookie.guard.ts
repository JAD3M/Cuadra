import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
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
import { RegistroPlataforma } from '../../plataforma/registro-plataforma.service';
import type { Scope, UsuarioAutenticado } from '../tipos';

/** Un solo mensaje para todo: no decimos si faltó o venció. */
const NO_AUTORIZADO = 'No autorizado';
/** 403 del cruce entre mundos: no dice cuál de los dos era la sesión. */
const ACCESO_DENEGADO = 'Acceso denegado';

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
    private readonly registro: RegistroPlataforma,
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
    if (!sesion) throw new UnauthorizedException(NO_AUTORIZADO);

    // AD-5: dos mundos que no se cruzan. La ruta es de plataforma si declara
    // ese scope o cuelga de `/plataforma` (por si alguien olvida el decorador);
    // la sesión es de plataforma por su tipo. Cualquier cruce es 403, queda en
    // `bitacora_plataforma` y no renueva la sesión ni toca la cookie.
    const rutaDePlataforma =
      scopesAceptados.includes('plataforma') ||
      esRutaBajoPlataforma(solicitud.path);
    const sesionDePlataforma = sesion.tipo === 'plataforma';
    if (rutaDePlataforma !== sesionDePlataforma) {
      await this.registro.registrar({
        accion: 'acceso_denegado',
        plataformaUsuarioId: sesion.plataformaUsuarioId,
        companyId: sesion.companyId,
        detalle: {
          metodo: solicitud.method,
          ruta: plantillaDeRuta(solicitud),
          tipoSesion: sesion.tipo,
          motivo: sesionDePlataforma
            ? 'sesion_de_plataforma_en_ruta_de_empresa'
            : 'sesion_de_empresa_en_ruta_de_plataforma',
          ip: solicitud.ip ?? null,
          userAgent: solicitud.headers?.['user-agent'] ?? null,
        },
      });
      throw new ForbiddenException(ACCESO_DENEGADO);
    }

    let usuario: UsuarioAutenticado;
    if (sesionDePlataforma) {
      if (sesion.plataformaUsuarioId === null) {
        throw new UnauthorizedException(NO_AUTORIZADO);
      }
      usuario = {
        scope: 'plataforma',
        plataformaUsuarioId: sesion.plataformaUsuarioId,
        sesionId: sesion.id,
      };
    } else {
      const userId = sesion.userId;
      if (userId === null) throw new UnauthorizedException(NO_AUTORIZADO);
      usuario =
        sesion.companyId === null
          ? { userId, scope: 'seleccion', sesionId: sesion.id }
          : {
              userId,
              scope: 'sesion',
              companyId: sesion.companyId,
              sesionId: sesion.id,
            };
    }
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

/** `/plataforma` y todo lo que cuelga de él, sin confundir `/plataformas`. */
function esRutaBajoPlataforma(ruta: string): boolean {
  return ruta === '/plataforma' || ruta.startsWith('/plataforma/');
}

/** La ruta como la declara el controlador (`/x/:id`), no con el valor real. */
function plantillaDeRuta(solicitud: Request): string {
  const ruta = solicitud.route as { path?: unknown } | undefined;
  return typeof ruta?.path === 'string' ? ruta.path : solicitud.path;
}

/** Valor de la cookie de sesión si viene y es texto; si no, null. */
export function leerCookie(solicitud: Request): string | null {
  const cookies = solicitud.cookies as Record<string, unknown> | undefined;
  const valor = cookies?.[COOKIE_SESION];
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}
