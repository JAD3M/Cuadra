import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { concatMap, type Observable } from 'rxjs';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { devolver, reservasPorSolicitud } from './limite.redis';

/**
 * Cierra lo que abrió `LimiteGuard`: si el handler terminó bien (2xx),
 * devuelve el intento reservado para que uno correcto no consuma. Si el
 * handler lanza, el intento sigue contado. Solo corre cuando el guard dejó
 * una reserva en la petición.
 */
@Injectable()
export class LimiteInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Limite');

  constructor(@Inject(CLIENTE_REDIS) private readonly cliente: Redis) {}

  intercept(
    contexto: ExecutionContext,
    siguiente: CallHandler,
  ): Observable<unknown> {
    const http = contexto.switchToHttp();
    const solicitud = http.getRequest<Request>();
    const respuesta = http.getResponse<Response>();
    if (!reservasPorSolicitud.has(solicitud)) return siguiente.handle();

    return siguiente.handle().pipe(
      concatMap(async (valor: unknown) => {
        const clave = reservasPorSolicitud.get(solicitud);
        const exito = respuesta.statusCode >= 200 && respuesta.statusCode < 300;
        if (clave && exito) {
          // Una sola devolución por petición aunque el handler emita más.
          reservasPorSolicitud.delete(solicitud);
          try {
            await devolver(this.cliente, clave);
          } catch (error) {
            // Quedar contado de más es el lado seguro; no se rompe la respuesta.
            this.logger.warn(
              `No se pudo devolver el intento: ${(error as Error).message}`,
            );
          }
        }
        return valor;
      }),
    );
  }
}
