import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CargasController } from './cargas.controller';
import { CargasService } from './cargas.service';
import { COLA_CARGAS, ColaCargas } from './cola-cargas';
import { ProcesadorCargas } from './procesador-cargas';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: COLA_CARGAS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: {
          attempts: config.getOrThrow<number>('COLA_INTENTOS'),
          backoff: {
            type: 'exponential',
            delay: config.getOrThrow<number>('COLA_ESPERA_MS'),
          },
          // Sin esto, cada job terminado se queda en Redis para siempre.
          // Los fallidos se guardan un rato para diagnosticar.
          removeOnComplete: true,
          removeOnFail: { count: 1000 },
        },
      }),
    }),
  ],
  controllers: [CargasController],
  providers: [CargasService, ColaCargas, ProcesadorCargas],
})
export class CargasModule {}
