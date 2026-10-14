import { Module } from '@nestjs/common';
import { SesionesModule } from '../auth/sesiones.module';
import { InvitacionesController } from './invitaciones.controller';
import { InvitacionesService } from './invitaciones.service';

/**
 * Historia 1.5. Consulta y aceptación pública del enlace de invitación. Las
 * guardas globales (origen, límite, sesión) las registra `AuthModule`, que
 * importa este módulo.
 */
@Module({
  imports: [SesionesModule],
  controllers: [InvitacionesController],
  providers: [InvitacionesService],
})
export class InvitacionesModule {}
