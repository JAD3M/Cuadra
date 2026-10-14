import {
  Body,
  Controller,
  Get,
  HttpCode,
  type INestApplication,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
import { CLIENTE_REDIS, crearClienteRedis } from '../redis/cliente-redis';
import { leerLimites, limpiarLimites } from '../testing/limites-de-pruebas';
import { Limite } from './limite.decorator';
import { LimiteModule, PROVEEDORES_LIMITE } from './limite.module';

/**
 * El mecanismo de `@Limite` (historia 1.2, AD-15) con un controlador de
 * mentira y el Redis real del compose. El login lo cubre auth.integracion.
 */

const PREFIJO = 'cuadra_test_limite';
process.env.COLA_PREFIJO = PREFIJO;

let llamadas = 0;

@Controller('prueba-limite')
class ControladorDePrueba {
  /** Falla salvo que el cuerpo traiga `ok: true`; hasta 3 fallos por minuto. */
  @Post('intento')
  @HttpCode(200)
  @Limite({ intentos: 3, ventanaS: 60 })
  intento(@Body() cuerpo: { ok?: boolean }) {
    llamadas += 1;
    if (cuerpo.ok !== true) throw new UnauthorizedException('No autorizado');
    return { ok: true };
  }

  /** Ventana de un segundo, para ver que vence. */
  @Post('corta')
  @HttpCode(200)
  @Limite({ intentos: 2, ventanaS: 1 })
  corta() {
    throw new UnauthorizedException('No autorizado');
  }

  /** Otra ruta que solo declara el decorador: el criterio de reutilización. */
  @Get('otra')
  @Limite({ intentos: 1, ventanaS: 60 })
  otra(): never {
    throw new UnauthorizedException('No autorizado');
  }

  /** Cuenta también los 2xx: cada envío exitoso consume (historia 1.5). */
  @Post('envio')
  @HttpCode(200)
  @Limite({ intentos: 2, ventanaS: 60, contarExitos: true })
  envio() {
    llamadas += 1;
    return { ok: true };
  }

  @Get('libre')
  libre() {
    return { ok: true };
  }
}

@Limite({ intentos: 1, ventanaS: 60 })
@Controller('prueba-limite-clase')
class ControladorConLimiteDeClase {
  @Get('uno')
  uno(): never {
    throw new UnauthorizedException('No autorizado');
  }
}

async function levantar(
  opciones: { trustProxy?: string; cliente?: Redis } = {},
): Promise<INestApplication<App>> {
  // ConfigModule.forRoot valida al llamarse: la variable va antes.
  if (opciones.trustProxy) process.env.TRUST_PROXY = opciones.trustProxy;
  else delete process.env.TRUST_PROXY;
  const constructor = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      LimiteModule,
    ],
    controllers: [ControladorDePrueba, ControladorConLimiteDeClase],
    providers: [...PROVEEDORES_LIMITE],
  });
  if (opciones.cliente) {
    constructor.overrideProvider(CLIENTE_REDIS).useValue(opciones.cliente);
  }
  const modulo = await constructor.compile();
  const app = modulo.createNestApplication<INestApplication<App>>();
  configurarApp(app);
  await app.listen(0);
  return app;
}

describe('@Limite', () => {
  let app: INestApplication<App>;
  let redis: Redis;
  const http = () => request(app.getHttpServer());
  const fallar = (ip?: string) => {
    const peticion = http().post('/prueba-limite/intento').send({ ok: false });
    return ip ? peticion.set('X-Forwarded-For', ip) : peticion;
  };

  beforeAll(async () => {
    app = await levantar();
    redis = app.get<Redis>(CLIENTE_REDIS);
  }, 30_000);

  afterAll(async () => {
    await limpiarLimites(redis, PREFIJO);
    await app?.close();
  });

  beforeEach(async () => {
    llamadas = 0;
    // Cada rechazo se registra en warn: sin ruido en la salida de los tests.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await limpiarLimites(redis, PREFIJO);
  });

  afterEach(() => jest.restoreAllMocks());

  it('cuenta los fallos y al pasar el tope responde 429 con Retry-After', async () => {
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    for (let i = 0; i < 3; i++) await fallar().expect(401);

    const res = await fallar().expect(429);

    expect(res.body).toEqual({
      statusCode: 429,
      message: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
      error: 'Too Many Requests',
    });
    const espera = Number(res.headers['retry-after']);
    expect(espera).toBeGreaterThanOrEqual(1);
    expect(espera).toBeLessThanOrEqual(60);
    // El rechazo no llegó al handler y queda en el registro sin datos de la persona.
    expect(llamadas).toBe(3);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(String(aviso.mock.calls[0][0])).toMatch(
      /Límite superado: ip=.* POST .*prueba-limite\/intento/,
    );
  });

  it('un intento correcto no consume: el contador vuelve a donde estaba', async () => {
    await fallar().expect(401);
    await fallar().expect(401);
    const clave = `${PREFIJO}:rl:ControladorDePrueba.intento:`;
    const antes = Object.entries(await leerLimites(redis, PREFIJO)).find(
      ([llave]) => llave.startsWith(clave),
    );
    expect(antes?.[1]).toBe('2');

    await http().post('/prueba-limite/intento').send({ ok: true }).expect(200);

    const despues = await leerLimites(redis, PREFIJO);
    expect(despues[antes![0]]).toBe('2');
    // Queda exactamente un fallo de margen.
    await fallar().expect(401);
    await fallar().expect(429);
  });

  it('con contarExitos las respuestas 2xx también consumen y al pasar el tope responde 429', async () => {
    const envio = () => http().post('/prueba-limite/envio').send({});
    await envio().expect(200);
    await envio().expect(200);

    const res = await envio().expect(429);

    expect(res.headers['retry-after']).toBeDefined();
    expect(llamadas).toBe(2);
  });

  it('contarExitos no cambia las rutas sin la opción: el éxito sigue sin consumir', async () => {
    for (let i = 0; i < 5; i++) {
      await http()
        .post('/prueba-limite/intento')
        .send({ ok: true })
        .expect(200);
    }
    expect(llamadas).toBe(5);
  });

  it('el contador no pasa a negativo ni borra la ventana al devolver', async () => {
    await http().post('/prueba-limite/intento').send({ ok: true }).expect(200);
    expect(await leerLimites(redis, PREFIJO)).toEqual({});

    await fallar().expect(401);
    const [llave] = Object.keys(await leerLimites(redis, PREFIJO));
    const antes = await redis.pttl(llave);
    await http().post('/prueba-limite/intento').send({ ok: true }).expect(200);
    const despues = await redis.pttl(llave);
    // La devolución no alarga la ventana.
    expect(despues).toBeLessThanOrEqual(antes);
    expect(despues).toBeGreaterThan(0);
  });

  it('veinte intentos paralelos: solo el tope llega al handler', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, () => fallar()),
    );
    const estados = respuestas.map((r) => r.status);

    expect(estados.filter((s) => s === 401)).toHaveLength(3);
    expect(estados.filter((s) => s === 429)).toHaveLength(17);
    expect(llamadas).toBe(3);
  });

  it('otra IP no se ve afectada cuando hay proxy de confianza', async () => {
    const detras = await levantar({ trustProxy: '1' });
    try {
      const pedir = (ip: string) =>
        request(detras.getHttpServer())
          .post('/prueba-limite/intento')
          .set('X-Forwarded-For', ip)
          .send({ ok: false });
      for (let i = 0; i < 3; i++) await pedir('10.0.0.1').expect(401);
      await pedir('10.0.0.1').expect(429);

      await pedir('10.0.0.2').expect(401);
    } finally {
      await detras.close();
    }
  });

  it('sin proxy de confianza ignora X-Forwarded-For', async () => {
    for (let i = 0; i < 3; i++) await fallar('10.0.0.1').expect(401);

    // Falsear la cabecera no da un contador nuevo.
    await fallar('10.0.0.2').expect(429);
  });

  it('la ventana vence y los intentos vuelven a permitirse', async () => {
    const corta = () => http().post('/prueba-limite/corta');
    await corta().expect(401);
    await corta().expect(401);
    await corta().expect(429);

    await new Promise((r) => setTimeout(r, 1300));

    await corta().expect(401);
  });

  it('otra ruta con @Limite funciona sin código nuevo y con su propio contador', async () => {
    await http().get('/prueba-limite/otra').expect(401);
    await http().get('/prueba-limite/otra').expect(429);

    // La primera ruta sigue con todo su margen.
    await fallar().expect(401);
  });

  it('el decorador también vale a nivel de controlador', async () => {
    await http().get('/prueba-limite-clase/uno').expect(401);
    await http().get('/prueba-limite-clase/uno').expect(429);
  });

  it('una ruta sin @Limite no toca Redis', async () => {
    const eval_ = jest.spyOn(redis, 'eval');

    await http().get('/prueba-limite/libre').expect(200);

    expect(eval_).not.toHaveBeenCalled();
    expect(await leerLimites(redis, PREFIJO)).toEqual({});
  });
});

describe('@Limite con Redis caído', () => {
  let app: INestApplication<App>;
  const cliente = crearClienteRedis('redis://127.0.0.1:1', {
    // Evita el temporizador de desconexión de 2 s tras cortar.
    disconnectTimeout: 100,
  });

  beforeAll(async () => {
    app = await levantar({ cliente });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    cliente.disconnect();
  });

  afterEach(() => jest.restoreAllMocks());

  it('responde 503 sin internos, lo registra y las rutas sin límite siguen', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const res = await request(app.getHttpServer())
      .post('/prueba-limite/intento')
      .send({ ok: true })
      .expect(503);

    expect(res.body).toEqual({
      statusCode: 503,
      message:
        'El servicio de acceso no está disponible. Inténtalo en unos minutos.',
      error: 'Service Unavailable',
    });
    expect(res.text).not.toMatch(/redis|127\.0\.0\.1|ECONN|eval/i);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).not.toContain('redis://');

    await request(app.getHttpServer()).get('/prueba-limite/libre').expect(200);
  });
});
