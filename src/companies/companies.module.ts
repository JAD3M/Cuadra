import { Module } from '@nestjs/common';
import { EmpresaController } from './empresa.controller';
import { ToleranciaService } from './tolerancia.service';

@Module({
  controllers: [EmpresaController],
  providers: [ToleranciaService],
})
export class CompaniesModule {}
