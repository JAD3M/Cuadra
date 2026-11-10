import { Module } from '@nestjs/common';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { DescarteController } from './descarte.controller';
import { DescarteService } from './descarte.service';
import { ReabrirController } from './reabrir.controller';
import { ReabrirService } from './reabrir.service';
import { ResolucionController } from './resolucion.controller';
import { ResolucionService } from './resolucion.service';

@Module({
  imports: [ConciliacionModule],
  controllers: [ResolucionController, DescarteController, ReabrirController],
  // AuthModule no exporta AccesosDenegados; solo necesita TransaccionEmpresa (global).
  providers: [
    ResolucionService,
    DescarteService,
    ReabrirService,
    AccesosDenegados,
  ],
})
export class ResolucionModule {}
