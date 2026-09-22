import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { ENTIDADES } from './database/entities';
import { SnakeNamingStrategy } from './database/naming.strategy';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: ENTIDADES,
        migrations: [__dirname + '/database/migrations/*.{ts,js}'],
        namingStrategy: new SnakeNamingStrategy(),
        // El esquema solo cambia por migración explícita.
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
