import { BullModule } from '@nestjs/bullmq';
import { Module, type Type } from '@nestjs/common';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { procesadoresDeColas } from '../colas/procesar-colas';
import { COLA_MUESTRAS, ColaMuestras } from './cola-muestras';
import { MedicionController } from './medicion.controller';
import { MuestraController } from './muestra.controller';
import { MuestrasService } from './muestras.service';
import { ProcesadorMuestras } from './procesador-muestras';
import { ProgramadorMuestras } from './programador-muestras';
import { SombraService } from './sombra.service';
import { VerificacionMuestraService } from './verificacion-muestra.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: COLA_MUESTRAS,
      defaultJobOptions: {
        // Sin reintentos automáticos: generar es idempotente, así que reencolar
        // a mano es seguro y un fallo queda visible en la cola.
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    }),
  ],
  controllers: [MedicionController, MuestraController],
  providers: [
    SombraService,
    MuestrasService,
    VerificacionMuestraService,
    AccesosDenegados,
    ColaMuestras,
    // Solo donde se consume la cola (ver colas/procesar-colas.ts): el
    // programador mensual se registra desde el mismo proceso que lo procesa.
    ...procesadoresDeColas<Type<unknown>>(
      ProcesadorMuestras,
      ProgramadorMuestras,
    ),
  ],
  exports: [SombraService, MuestrasService, ColaMuestras],
})
export class SombraModule {}
