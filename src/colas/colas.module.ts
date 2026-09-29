import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Conexión a Redis para BullMQ (CU-08), en el mismo proceso que la api
 * (D-01). Cada módulo registra sus colas con `BullModule.registerQueue`.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            username: url.username || undefined,
            password: url.password
              ? decodeURIComponent(url.password)
              : undefined,
            db: Number(url.pathname.replace(/^\//, '')) || 0,
          },
          prefix: config.getOrThrow<string>('COLA_PREFIJO'),
        };
      },
    }),
  ],
})
export class ColasModule {}
