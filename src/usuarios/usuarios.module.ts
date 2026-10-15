import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { InvitacionesPendientesService } from './invitaciones-pendientes.service';
import { InvitarUsuariosService } from './invitar-usuarios.service';
import { UsuariosController } from './usuarios.controller';

/**
 * Historia 2.3. Gestión de las personas de la empresa; hoy, invitar. Las
 * guardas globales (origen, límite, sesión, roles) y la transacción de
 * empresa las registra `AuthModule` y `ContextoEmpresaModule`.
 */
@Module({
  imports: [CorreoModule],
  controllers: [UsuariosController],
  providers: [InvitarUsuariosService, InvitacionesPendientesService],
})
export class UsuariosModule {}
