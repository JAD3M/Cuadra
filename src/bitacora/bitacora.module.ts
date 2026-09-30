import { Module } from '@nestjs/common';
import { BitacoraService } from './bitacora.service';
import { HistorialController } from './historial.controller';

/** CU-16. Lectura de la bitácora; la escritura vive en cada dominio. */
@Module({
  controllers: [HistorialController],
  providers: [BitacoraService],
})
export class BitacoraModule {}
