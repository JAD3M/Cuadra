import { Module } from '@nestjs/common';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { ComentarController } from './comentar.controller';
import { ComentarService } from './comentar.service';
import { DescarteController } from './descarte.controller';
import { DescarteService } from './descarte.service';
import { ReabrirController } from './reabrir.controller';
import { ReabrirService } from './reabrir.service';
import { ResolucionController } from './resolucion.controller';
import { ResolucionService } from './resolucion.service';

@Module({
  imports: [ConciliacionModule],
  controllers: [
    ResolucionController,
    DescarteController,
    ReabrirController,
    ComentarController,
  ],
  // AuthModule no exporta AccesosDenegados; solo necesita TransaccionEmpresa (global).
  providers: [
    ResolucionService,
    DescarteService,
    ReabrirService,
    ComentarService,
    AccesosDenegados,
  ],
})
export class ResolucionModule {}
