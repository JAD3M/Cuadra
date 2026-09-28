import { Module } from '@nestjs/common';
import { CargasController } from './cargas.controller';
import { CargasService } from './cargas.service';

@Module({
  controllers: [CargasController],
  providers: [CargasService],
})
export class CargasModule {}
