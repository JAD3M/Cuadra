import {
  Controller,
  Delete,
  Get,
  HttpCode,
  type INestApplication,
  Logger,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
import { Publico } from '../common/decorators/decoradores';
import { Limite } from '../limite/limite.decorator';
import { LimiteModule, PROVEEDORES_LIMITE } from '../limite/limite.module';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { leerLimites, limpiarLimites } from '../testing/limites-de-pruebas';
import { OrigenGuard } from './origen.guard';

/**
 * La comprobación de `Origin` (historia 1.2, AD-6) con un controlador de
 * mentira, el guard real y el límite real delante de Redis. El caso del
 * login y del logout reales vive en auth.integracion.
 */

const PREFIJO = 'cuadra_test_origen';
process.env.COLA_PREFIJO = PREFIJO;

let efectos = 0;

@Controller('prueba-origen')
class ControladorDePrueba {
  @Post('uno')
  @HttpCode(200)
  crear() {
    efectos += 1;
    return { ok: true };
  }

  @Put('uno')
  reemplazar() {
    efectos += 1;
    return { ok: true };
  }

  @Patch('uno')
  parchar() {
    efectos += 1;
    return { ok: true };
  }

  @Delete('uno')
  borrar() {
    efectos += 1;
    return { ok: true };
  }

  @Get('uno')
  leer() {
    return { ok: true };
  }

  @Publico()
  @Post('publico')
  @HttpCode(200)
  publico() {
    efectos += 1;
    return { ok: true };
  }

  /** Con límite: sirve para ver que un origen malo no consume el contador. */
  @Publico()
  @Post('limitado')
  @HttpCode(200)
  @Limite({ intentos: 2, ventanaS: 60 })
  limitado() {
    efectos += 1;
    return { ok: true };
  }
}

describe('OrigenGuard', () => {
  const AUTORIZADO = 'http://localhost:5173';
  let app: INestApplication<App>;
  let redis: Redis;
  let advertencias: jest.SpyInstance;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.ORIGEN_AUTORIZADO = AUTORIZADO;
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        LimiteModule,
      ],
      controllers: [ControladorDePrueba],
      // El guard de origen va primero, como en `AuthModule`.
      providers: [
        { provide: APP_GUARD, useClass: OrigenGuard },
        ...PROVEEDORES_LIMITE,
      ],
    }).compile();
    app = modulo.createNestApplication<INestApplication<App>>();
    configurarApp(app);
    await app.listen(0);
    redis = app.get<Redis>(CLIENTE_REDIS);
  }, 30_000);

  afterAll(async () => {
    await limpiarLimites(redis, PREFIJO);
    await app?.close();
  });

  beforeEach(async () => {
    efectos = 0;
    await limpiarLimites(redis, PREFIJO);
    advertencias = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => advertencias.mockRestore());

  describe.each([
    ['POST', (u: string) => http().post(u)],
    ['PUT', (u: string) => http().put(u)],
    ['PATCH', (u: string) => http().patch(u)],
    ['DELETE', (u: string) => http().delete(u)],
  ])('%s', (_metodo, peticion) => {
    it('pasa con el origen autorizado', async () => {
      await peticion('/prueba-origen/uno')
        .set('Origin', AUTORIZADO)
        .expect(200);
      expect(efectos).toBe(1);
    });

    it.each([
      ['otro origen', 'http://malo.example'],
      ['null', 'null'],
      ['barra final', `${AUTORIZADO}/`],
      ['otro puerto', 'http://localhost:5174'],
      ['otro esquema', 'https://localhost:5173'],
      ['otra capitalización', 'http://LOCALHOST:5173'],
    ])('rechaza con 403: %s', async (_caso, origen) => {
      const res = await peticion('/prueba-origen/uno')
        .set('Origin', origen)
        .expect(403);
      expect(efectos).toBe(0);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rechaza con 403 sin la cabecera Origin', async () => {
      await peticion('/prueba-origen/uno').expect(403);
      expect(efectos).toBe(0);
    });
  });

  it.each([
    ['GET', () => http().get('/prueba-origen/uno')],
    ['HEAD', () => http().head('/prueba-origen/uno')],
    ['OPTIONS', () => http().options('/prueba-origen/uno')],
  ])('%s sin Origin no se comprueba', async (_metodo, peticion) => {
    const res = await peticion();
    // Sin ruta propia, OPTIONS puede responder 404: lo que importa es que el
    // guard de origen no lo rechace con 403.
    expect(res.status).not.toBe(403);
  });

  it('una ruta @Publico() también exige el origen', async () => {
    await http().post('/prueba-origen/publico').expect(403);
    await http()
      .post('/prueba-origen/publico')
      .set('Origin', 'http://malo.example')
      .expect(403);
    await http()
      .post('/prueba-origen/publico')
      .set('Origin', AUTORIZADO)
      .expect(200);
    expect(efectos).toBe(1);
  });

  it('el 403 es claro y no revela internos ni concede CORS comodín', async () => {
    const res = await http()
      .post('/prueba-origen/uno')
      .set('Origin', 'http://malo.example')
      .expect(403);
    expect(res.body).toEqual({
      statusCode: 403,
      message: 'La petición no proviene de un origen autorizado.',
      error: 'Forbidden',
    });
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    expect(JSON.stringify(res.body)).not.toContain(AUTORIZADO);
  });

  it('un origen malo no consume el límite; con el autorizado sí cuenta', async () => {
    for (let i = 0; i < 5; i += 1) {
      await http()
        .post('/prueba-origen/limitado')
        .set('Origin', 'http://malo.example')
        .expect(403);
    }
    await http().post('/prueba-origen/limitado').expect(403);
    expect(await leerLimites(redis, PREFIJO)).toEqual({});
    expect(efectos).toBe(0);

    // Con el origen bueno las respuestas 2xx devuelven el intento: sigue pasando.
    for (let i = 0; i < 3; i += 1) {
      await http()
        .post('/prueba-origen/limitado')
        .set('Origin', AUTORIZADO)
        .expect(200);
    }
  });

  it('registra el rechazo con IP, método y plantilla, y recorta el origen', async () => {
    const largo = `http://${'a'.repeat(500)}.example`;
    await http().post('/prueba-origen/uno').set('Origin', largo).expect(403);
    expect(advertencias).toHaveBeenCalledTimes(1);
    const [[linea]] = advertencias.mock.calls as [[string]];
    const mensaje = linea;
    expect(mensaje).toContain('POST');
    expect(mensaje).toContain('/prueba-origen/uno');
    expect(mensaje).toMatch(/ip=\S+/);
    expect(mensaje).not.toContain('a'.repeat(100));
  });

  it('el preflight CORS del origen autorizado sigue funcionando', async () => {
    const res = await http()
      .options('/prueba-origen/uno')
      .set('Origin', AUTORIZADO)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(AUTORIZADO);
  });
});
