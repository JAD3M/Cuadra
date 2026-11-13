import { Module } from '@nestjs/common';
import { MedicionController } from './medicion.controller';
import { SombraService } from './sombra.service';

@Module({
  controllers: [MedicionController],
  providers: [SombraService],
  exports: [SombraService],
})
export class SombraModule {}
