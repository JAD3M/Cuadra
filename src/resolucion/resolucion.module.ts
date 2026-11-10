import { Module } from '@nestjs/common';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { DescarteController } from './descarte.controller';
import { DescarteService } from './descarte.service';
import { ResolucionController } from './resolucion.controller';
import { ResolucionService } from './resolucion.service';

@Module({
  imports: [ConciliacionModule],
  controllers: [ResolucionController, DescarteController],
  // AuthModule no exporta AccesosDenegados; solo necesita TransaccionEmpresa (global).
  providers: [ResolucionService, DescarteService, AccesosDenegados],
})
export class ResolucionModule {}
