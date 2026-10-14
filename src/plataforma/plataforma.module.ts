import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SesionesModule } from '../auth/sesiones.module';
import { CorreoModule } from '../correo/correo.module';
import { BitacoraPlataforma } from './bitacora-plataforma.entity';
import { EmpresasPlataforma } from './empresas-plataforma.service';
import { InvitacionesPlataforma } from './invitaciones-plataforma.service';
import { PlataformaAuthController } from './plataforma-auth.controller';
import { PlataformaAuthService } from './plataforma-auth.service';
import { PlataformaUsuario } from './plataforma-usuario.entity';
import { PlataformaController } from './plataforma.controller';
import { RegistroPlataforma } from './registro-plataforma.service';

/**
 * Mundo del dueño de Cuadra (AD-2 clase 3, AD-5). Solo aquí se nombran
 * `plataforma_usuarios` y `bitacora_plataforma`. Exporta `RegistroPlataforma`
 * para que el guard de sesión registre los accesos cruzados sin tocar la tabla.
 */
@Module({
  imports: [
    SesionesModule,
    CorreoModule,
    TypeOrmModule.forFeature([PlataformaUsuario, BitacoraPlataforma]),
  ],
  controllers: [PlataformaAuthController, PlataformaController],
  providers: [
    PlataformaAuthService,
    RegistroPlataforma,
    EmpresasPlataforma,
    InvitacionesPlataforma,
  ],
  exports: [RegistroPlataforma],
})
export class PlataformaModule {}
