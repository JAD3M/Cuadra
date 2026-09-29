import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { ENTIDADES } from './database/entidades';
import { SnakeNamingStrategy } from './database/naming.strategy';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { BancosModule } from './bancos/bancos.module';
import { CargasModule } from './cargas/cargas.module';
import { ColasModule } from './colas/colas.module';
import { ContextoEmpresaModule } from './database/contexto-empresa.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // cuadra_app, sujeto a RLS. Migraciones y seed van por data-source.ts
        // con el dueño.
        url: config.get<string>('DATABASE_APP_URL'),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
        // El esquema solo cambia por migración explícita.
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    ContextoEmpresaModule,
    ColasModule,
    HealthModule,
    AuthModule,
    CargasModule,
    BancosModule,
  ],
})
export class AppModule {}
