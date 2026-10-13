import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { CLIENTE_REDIS, crearClienteRedis } from './cliente-redis';

/**
 * Cliente Redis compartido por la app (AD-15). BullMQ y `/health` siguen con
 * sus propias conexiones. Si Redis está caído al arrancar la app arranca igual:
 * cada comando falla rápido y quien lo usa decide qué hacer.
 */
@Global()
@Module({
  providers: [
    {
      provide: CLIENTE_REDIS,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const cliente = crearClienteRedis(
          config.getOrThrow<string>('REDIS_URL'),
        );
        // El error ya queda en el log; el arranque no depende de Redis.
        await cliente.connect().catch(() => undefined);
        return cliente;
      },
    },
  ],
  exports: [CLIENTE_REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(CLIENTE_REDIS) private readonly cliente: Redis) {}

  async onModuleDestroy() {
    try {
      await this.cliente.quit();
    } catch {
      // Sin conexión no hay QUIT que enviar.
    } finally {
      // Cierra el socket sin esperar el evento y para los reintentos.
      this.cliente.disconnect();
    }
  }
}
