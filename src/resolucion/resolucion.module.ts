import { Module } from '@nestjs/common';
import { ConciliacionModule } from '../conciliacion/conciliacion.module';
import { ResolucionController } from './resolucion.controller';
import { ResolucionService } from './resolucion.service';

@Module({
  imports: [ConciliacionModule],
  controllers: [ResolucionController],
  providers: [ResolucionService],
})
export class ResolucionModule {}
