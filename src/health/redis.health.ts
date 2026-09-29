import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';

const ESPERA_MS = 2000;

/**
 * CU-01.2: el Redis de la cola (CU-08). Abre una conexión corta por chequeo,
 * con `REDIS_URL` como el resto de la app: si Redis cae, el reintento
 * automático de ioredis no debe colgar `/health`, debe reportarlo caído.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly config: ConfigService,
    private readonly indicador: HealthIndicatorService,
  ) {}

  async pingCheck(key: string) {
    const sesion = this.indicador.check(key);
    const cliente = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      connectTimeout: ESPERA_MS,
      commandTimeout: ESPERA_MS,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    // Sin oyente, un fallo de conexión sale como 'unhandled error event'.
    cliente.on('error', () => undefined);
    try {
      await cliente.connect();
      await cliente.ping();
      return sesion.up();
    } catch (error) {
      return sesion.down({
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      cliente.disconnect();
    }
  }
}
