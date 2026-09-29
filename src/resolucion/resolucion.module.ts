import { Module } from '@nestjs/common';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { ResolucionController } from './resolucion.controller';
import { ResolucionService } from './resolucion.service';

@Module({
  imports: [ConciliacionModule],
  controllers: [ResolucionController],
  // AuthModule no exporta AccesosDenegados; solo necesita TransaccionEmpresa (global).
  providers: [ResolucionService, AccesosDenegados],
})
export class ResolucionModule {}
