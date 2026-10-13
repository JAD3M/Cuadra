import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { PasswordHasher } from './password';
import { UserCompanyRole } from '../companies/user-company-role.entity';
import { APP_GUARD } from '@nestjs/core';
import { SesionCookieGuard } from './guards/sesion-cookie.guard';
import { Sesion } from './sesion.entity';
import { SesionesService } from './sesiones.service';
import { RolesGuard } from './guards/roles.guard';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ContextoEmpresaModule } from '../database/contexto-empresa.module';
import { LimiteModule, PROVEEDORES_LIMITE } from '../limite/limite.module';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SesionesService,
    PasswordHasher,
    AccesosDenegados,
    // Globales y en este orden: primero el límite de intentos (corre también
    // en rutas @Publico(), como el login), luego quién eres, luego qué
    // puedes hacer. Todo endpoint exige sesión salvo que se marque @Publico().
    ...PROVEEDORES_LIMITE,
    { provide: APP_GUARD, useClass: SesionCookieGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    // Cliente Redis del límite de intentos.
    LimiteModule,
    // TransaccionEmpresa: RolesGuard escribe en la bitácora antes del interceptor.
    ContextoEmpresaModule,
    TypeOrmModule.forFeature([User, UserCompanyRole, Sesion]),
  ],
})
export class AuthModule {}
