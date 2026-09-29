import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { PasswordHasher } from './password';
import { JwtModule } from '@nestjs/jwt';
import { UserCompanyRole } from '../companies/user-company-role.entity';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { ContextoEmpresaModule } from '../database/contexto-empresa.module';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    AccesosDenegados,
    // Globales y en este orden: primero quién eres, luego qué puedes hacer.
    // Todo endpoint exige token salvo que se marque @Publico().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    // TransaccionEmpresa: RolesGuard escribe en la bitácora antes del interceptor.
    ContextoEmpresaModule,
    TypeOrmModule.forFeature([User, UserCompanyRole]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        signOptions: {
          expiresIn: '5m',
        },
      }),
    }),
  ],
})
export class AuthModule {}
