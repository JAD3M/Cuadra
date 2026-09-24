// src/database/data-source.ts
import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTIDADES } from './entidades';
import { SnakeNamingStrategy } from './naming.strategy';

cargarEnv({ quiet: true });

export const opcionesDataSource: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ENTIDADES,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  namingStrategy: new SnakeNamingStrategy(),
  // El esquema solo cambia por migración; nunca se sincroniza solo.
  synchronize: false,
  migrationsRun: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
};

/** Export por defecto: es lo que consume la CLI de TypeORM. */
export default new DataSource(opcionesDataSource);
