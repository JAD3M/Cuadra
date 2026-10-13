import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configurarApp } from './configurar-app';

/**
 * `configurarApp` es lo que comparten main.ts y los specs de integración:
 * aquí se prueba solo, sin base de datos.
 */

class EntradaDto {
  @IsString()
  nombre!: string;
}

@Controller('prueba')
class ControladorDePrueba {
  @Get('ip')
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }

  @Get('cookie')
  cookie(@Req() req: Request) {
    return { valor: (req.cookies as Record<string, string>).k };
  }

  @Post('dto')
  dto(@Body() cuerpo: EntradaDto) {
    return cuerpo;
  }
}

const AUTORIZADO = 'https://cuadra.example';
const OTRO = 'https://otro.example';
const CLIENTE = '203.0.113.7';

const ORIGINAL = {
  origen: process.env.ORIGEN_AUTORIZADO,
  proxy: process.env.TRUST_PROXY,
};

function restaurar(llave: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[llave];
  else process.env[llave] = valor;
}

async function levantar(
  trustProxy: string | undefined,
): Promise<INestApplication<App>> {
  process.env.ORIGEN_AUTORIZADO = AUTORIZADO;
  restaurar('TRUST_PROXY', trustProxy);
  const modulo = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
    controllers: [ControladorDePrueba],
  }).compile();
  const app = modulo.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.init();
  return app;
}

describe('configurarApp', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  afterAll(() => {
    restaurar('ORIGEN_AUTORIZADO', ORIGINAL.origen);
    restaurar('TRUST_PROXY', ORIGINAL.proxy);
  });

  describe('trust proxy', () => {
    it('apagado: req.ip ignora X-Forwarded-For', async () => {
      app = await levantar(undefined);
      const res = await request(app.getHttpServer())
        .get('/prueba/ip')
        .set('X-Forwarded-For', CLIENTE)
        .expect(200);
      expect((res.body as { ip: string }).ip).not.toContain(CLIENTE);
    });

    it('con saltos: req.ip es la dirección del cliente reenviada', async () => {
      app = await levantar('1');
      const res = await request(app.getHttpServer())
        .get('/prueba/ip')
        .set('X-Forwarded-For', CLIENTE)
        .expect(200);
      expect((res.body as { ip: string }).ip).toBe(CLIENTE);
    });

    it("con 'true': req.ip es la dirección del cliente reenviada", async () => {
      app = await levantar('true');
      const res = await request(app.getHttpServer())
        .get('/prueba/ip')
        .set('X-Forwarded-For', CLIENTE)
        .expect(200);
      expect((res.body as { ip: string }).ip).toBe(CLIENTE);
    });
  });

  describe('CORS', () => {
    beforeEach(async () => {
      app = await levantar(undefined);
    });

    it('al origen autorizado le responde con él mismo y credenciales', async () => {
      const res = await request(app.getHttpServer())
        .options('/prueba/dto')
        .set('Origin', AUTORIZADO)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
      expect(res.headers['access-control-allow-origin']).toBe(AUTORIZADO);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('en una petición normal también lo declara', async () => {
      const res = await request(app.getHttpServer())
        .get('/prueba/ip')
        .set('Origin', AUTORIZADO)
        .expect(200);
      expect(res.headers['access-control-allow-origin']).toBe(AUTORIZADO);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('a otro origen no le responde ninguna cabecera CORS', async () => {
      for (const origen of [OTRO, 'null', AUTORIZADO + '.otro.example']) {
        const normal = await request(app.getHttpServer())
          .get('/prueba/ip')
          .set('Origin', origen);
        expect(normal.headers['access-control-allow-origin']).toBeUndefined();
        expect(
          normal.headers['access-control-allow-credentials'],
        ).toBeUndefined();

        const previo = await request(app.getHttpServer())
          .options('/prueba/dto')
          .set('Origin', origen)
          .set('Access-Control-Request-Method', 'POST');
        expect(previo.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('nunca responde *', async () => {
      const res = await request(app.getHttpServer())
        .get('/prueba/ip')
        .set('Origin', OTRO);
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('cookie-parser y ValidationPipe', () => {
    beforeEach(async () => {
      app = await levantar(undefined);
    });

    it('lee las cookies', async () => {
      const res = await request(app.getHttpServer())
        .get('/prueba/cookie')
        .set('Cookie', 'k=v')
        .expect(200);
      expect((res.body as { valor: string }).valor).toBe('v');
    });

    it('rechaza propiedades que el DTO no declara', async () => {
      await request(app.getHttpServer())
        .post('/prueba/dto')
        .send({ nombre: 'x', extra: 1 })
        .expect(400);
      await request(app.getHttpServer())
        .post('/prueba/dto')
        .send({ nombre: 'x' })
        .expect(201);
    });
  });
});
