import { Module } from '@nestjs/common';
import { BancosController } from './bancos.controller';
import { cargarPerfiles } from './perfil';
import { DIRECTORIO_PERFILES, PerfilesBancarios } from './perfiles-bancarios';

@Module({
  controllers: [BancosController],
  providers: [
    {
      provide: PerfilesBancarios,
      // Al arrancar: un perfil inválido lanza aquí y la api no levanta.
      useFactory: () =>
        new PerfilesBancarios(cargarPerfiles(DIRECTORIO_PERFILES)),
    },
  ],
  exports: [PerfilesBancarios],
})
export class BancosModule {}
