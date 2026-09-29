import { config as cargarEnv } from 'dotenv';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { validateEnv } from '../config/env.validation';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import {
  crearBaseDePruebas,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { HealthModule } from './health.module';

cargarEnv({ quiet: true });

/**
 * CU-01.2 contra Postgres y Redis reales. Para el caso caído se apunta
 * REDIS_URL a un puerto sin nadie escuchando.
 */

async function levantar(): Promise<INestApplication<App>> {
  await crearBaseDePruebas(urlDePruebas());
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      HealthModule,
    ],
  }).compile();
  const app = modulo.createNestApplication();
  await app.init();
  return app;
}

describe('GET /health', () => {
  let app: INestApplication<App>;
  const redisOriginal = process.env.REDIS_URL;

  afterEach(async () => {
    process.env.REDIS_URL = redisOriginal;
    await app?.close();
  });

  it('200 con postgres y redis arriba, sin token', async () => {
    app = await levantar();
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      info: { postgres: { status: 'up' }, redis: { status: 'up' } },
    });
  }, 30_000);

  it('503 con el detalle de redis caído y postgres arriba', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    app = await levantar();
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body).toMatchObject({
      status: 'error',
      info: { postgres: { status: 'up' } },
      error: { redis: { status: 'down' } },
    });
  }, 30_000);
});
