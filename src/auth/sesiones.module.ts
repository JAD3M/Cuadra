import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordHasher } from './password';
import { Sesion } from './sesion.entity';
import { SesionesService } from './sesiones.service';

/**
 * Sesiones y hash de contraseñas, compartidos por el login de empresa
 * (`AuthModule`) y el de plataforma (`PlataformaModule`). Módulo aparte para
 * que `AuthModule` importe a plataforma sin ciclo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Sesion])],
  providers: [SesionesService, PasswordHasher],
  exports: [SesionesService, PasswordHasher],
})
export class SesionesModule {}
