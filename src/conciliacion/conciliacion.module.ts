import { Module } from '@nestjs/common';
import { ConciliacionService } from './conciliacion.service';
import { ProveedorTolerancia, ToleranciaConstante } from './tolerancia';

@Module({
  providers: [
    ConciliacionService,
    // CU-12 cambia solo esta línea para leer la tolerancia de la empresa.
    { provide: ProveedorTolerancia, useClass: ToleranciaConstante },
  ],
  exports: [ConciliacionService],
})
export class ConciliacionModule {}
