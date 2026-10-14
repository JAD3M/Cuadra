import { Module } from '@nestjs/common';
import { SesionesModule } from '../auth/sesiones.module';
import { CorreoModule } from '../correo/correo.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { RecuperacionController } from './recuperacion.controller';
import { RecuperacionService } from './recuperacion.service';

/**
 * Historia 1.6. Pedir, consultar y consumir el enlace de recuperación de
 * contraseña (público). Las guardas globales las registra `AuthModule`, que
 * importa este módulo.
 */
@Module({
  imports: [SesionesModule, CorreoModule, PlataformaModule],
  controllers: [RecuperacionController],
  providers: [RecuperacionService],
})
export class RecuperacionModule {}
