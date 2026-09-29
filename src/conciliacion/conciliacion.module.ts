import { Module } from '@nestjs/common';
import { ConciliacionService } from './conciliacion.service';
import { ProveedorTolerancia, ToleranciaPorEmpresa } from './tolerancia';

@Module({
  providers: [
    ConciliacionService,
    { provide: ProveedorTolerancia, useClass: ToleranciaPorEmpresa },
  ],
  exports: [ConciliacionService],
})
export class ConciliacionModule {}
