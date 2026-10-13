import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const ORIGEN_NO_AUTORIZADO = 'La petición no proviene de un origen autorizado.';

/** Métodos que no cambian datos: no llevan comprobación de origen. */
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** El valor recibido es del atacante: solo un fragmento corto va al log. */
const LARGO_MAXIMO_EN_LOG = 64;

/**
 * Toda petición que cambia datos debe traer un `Origin` igual, carácter por
 * carácter, a `ORIGEN_AUTORIZADO` (AD-6); si no, 403 sin tocar nada. Cubre
 * también las rutas `@Publico()`: el login sin esta comprobación admite
 * login CSRF. Sin cabecera `Origin` también se rechaza.
 *
 * Las lecturas (GET, HEAD, OPTIONS) pasan: no cambian estado y el preflight
 * de CORS lo contesta `configurarApp` antes de llegar aquí. Cualquier otro
 * método se trata como que cambia datos (falla cerrada).
 *
 * No toca Redis ni la base: corre antes del límite de intentos, así que un
 * origen equivocado nunca consume el contador del login.
 */
@Injectable()
export class OrigenGuard implements CanActivate {
  private readonly logger = new Logger('Origen');
  private readonly autorizado: string;

  constructor(config: ConfigService) {
    this.autorizado = config.getOrThrow<string>('ORIGEN_AUTORIZADO');
  }

  canActivate(contexto: ExecutionContext): boolean {
    const solicitud = contexto.switchToHttp().getRequest<Request>();
    if (METODOS_SEGUROS.has(solicitud.method.toUpperCase())) return true;

    const recibido = solicitud.headers.origin;
    if (recibido === this.autorizado) return true;

    const plantilla =
      (solicitud.route as { path?: string } | undefined)?.path ??
      solicitud.path;
    const mostrado =
      recibido === undefined
        ? 'ausente'
        : JSON.stringify(recibido.slice(0, LARGO_MAXIMO_EN_LOG));
    this.logger.warn(
      `Origen rechazado: ip=${solicitud.ip ?? 'desconocida'} ${solicitud.method} ${plantilla} origen=${mostrado}`,
    );
    throw new ForbiddenException(ORIGEN_NO_AUTORIZADO);
  }
}
