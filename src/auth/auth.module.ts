import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UserCompanyRole } from '../companies/user-company-role.entity';
import { APP_GUARD } from '@nestjs/core';
import { SesionCookieGuard } from './guards/sesion-cookie.guard';
import { SesionesModule } from './sesiones.module';
import { PlataformaModule } from '../plataforma/plataforma.module';
import { RolesGuard } from './guards/roles.guard';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ContextoEmpresaModule } from '../database/contexto-empresa.module';
import { LimiteModule, PROVEEDORES_LIMITE } from '../limite/limite.module';
import { OrigenGuard } from '../origen/origen.guard';
import { InvitacionesModule } from '../invitaciones/invitaciones.module';
import { RecuperacionModule } from '../recuperacion/recuperacion.module';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AccesosDenegados,
    // Globales y en este orden: primero el origen (barato, sin Redis: una
    // petición de otro origen nunca consume el contador del login), luego el
    // límite de intentos (corre también en rutas @Publico(), como el login),
    // luego quién eres, luego qué puedes hacer. Todo endpoint exige sesión
    // salvo que se marque @Publico().
    { provide: APP_GUARD, useClass: OrigenGuard },
    ...PROVEEDORES_LIMITE,
    { provide: APP_GUARD, useClass: SesionCookieGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    // Cliente Redis del límite de intentos.
    LimiteModule,
    // TransaccionEmpresa: RolesGuard escribe en la bitácora antes del interceptor.
    ContextoEmpresaModule,
    // Sesiones y hash compartidos con el login de plataforma.
    SesionesModule,
    // AD-5: el guard de sesión registra ahí los cruces entre mundos.
    PlataformaModule,
    // Historia 1.5: consultar y aceptar el enlace de invitación (público).
    InvitacionesModule,
    // Historia 1.6: recuperar la contraseña por correo (público).
    RecuperacionModule,
    TypeOrmModule.forFeature([User, UserCompanyRole]),
  ],
})
export class AuthModule {}
