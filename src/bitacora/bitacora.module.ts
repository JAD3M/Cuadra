import { Module } from '@nestjs/common';
import { BitacoraController } from './bitacora.controller';
import { BitacoraService } from './bitacora.service';
import { HistorialController } from './historial.controller';

/** CU-16. Lectura de la bitácora; la escritura vive en cada dominio. */
@Module({
  controllers: [HistorialController, BitacoraController],
  providers: [BitacoraService],
})
export class BitacoraModule {}
