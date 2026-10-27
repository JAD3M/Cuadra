import { Module } from '@nestjs/common';
import { CorreoModule } from '../correo/correo.module';
import { CambiarRolesService } from './cambiar-roles.service';
import { InvitacionesPendientesService } from './invitaciones-pendientes.service';
import { InvitarUsuariosService } from './invitar-usuarios.service';
import { ListarUsuariosService } from './listar-usuarios.service';
import { UsuariosController } from './usuarios.controller';

/**
 * Historia 2.3. Gestión de las personas de la empresa: invitar, listar y cambiar o quitar roles. Las
 * guardas globales (origen, límite, sesión, roles) y la transacción de
 * empresa las registra `AuthModule` y `ContextoEmpresaModule`.
 */
@Module({
  imports: [CorreoModule],
  controllers: [UsuariosController],
  providers: [
    InvitarUsuariosService,
    InvitacionesPendientesService,
    ListarUsuariosService,
    CambiarRolesService,
  ],
})
export class UsuariosModule {}
