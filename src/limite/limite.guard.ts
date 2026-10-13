import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { LLAVE_LIMITE, type OpcionesLimite } from './limite.decorator';
import { type Reserva, reservar, reservasPorSolicitud } from './limite.redis';

const DEMASIADOS_INTENTOS =
  'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
const SERVICIO_NO_DISPONIBLE =
  'El servicio de acceso no está disponible. Inténtalo en unos minutos.';

/**
 * Aplica `@Limite` (AD-15). Reserva un intento de forma atómica antes del
 * handler; `LimiteInterceptor` lo devuelve si la respuesta es 2xx. Las rutas
 * sin `@Limite` no tocan Redis.
 *
 * Nunca recibe ni registra el cuerpo: ni el correo ni la contraseña pasan
 * por aquí, y la clave lleva solo la IP.
 */
@Injectable()
export class LimiteGuard implements CanActivate {
  private readonly logger = new Logger('Limite');
  private readonly prefijo: string;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
    @Inject(CLIENTE_REDIS) private readonly cliente: Redis,
  ) {
    this.prefijo = config.getOrThrow<string>('COLA_PREFIJO');
  }

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const opciones = this.reflector.getAllAndOverride<
      OpcionesLimite | undefined
    >(LLAVE_LIMITE, [contexto.getHandler(), contexto.getClass()]);
    if (!opciones) return true;

    const http = contexto.switchToHttp();
    const solicitud = http.getRequest<Request>();
    const respuesta = http.getResponse<Response>();
    const ip = solicitud.ip ?? 'desconocida';
    const destino = `${contexto.getClass().name}.${contexto.getHandler().name}`;
    const clave = `${this.prefijo}:rl:${destino}:${ip}`;

    let reserva: Reserva;
    try {
      reserva = await reservar(this.cliente, clave, opciones.ventanaS);
    } catch (error) {
      // Solo el mensaje del error: nunca la URL de conexión.
      this.logger.error(
        `Redis no respondió; ${destino} rechaza la petición (falla cerrada): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(SERVICIO_NO_DISPONIBLE);
    }

    if (reserva.intentos > opciones.intentos) {
      const plantilla =
        (solicitud.route as { path?: string } | undefined)?.path ?? destino;
      this.logger.warn(
        `Límite superado: ip=${ip} ${solicitud.method} ${plantilla}`,
      );
      respuesta.setHeader('Retry-After', String(reserva.restanteS));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: DEMASIADOS_INTENTOS,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    reservasPorSolicitud.set(solicitud, clave);
    return true;
  }
}
