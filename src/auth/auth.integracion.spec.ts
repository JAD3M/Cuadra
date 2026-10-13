import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from '../testing/supertest-con-origen';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { configurarApp } from '../configurar-app';
import { validateEnv } from '../config/env.validation';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import { PASSWORD_SEMILLA, sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { AuthModule } from './auth.module';
import { Roles, Scope } from '../common/decorators/decoradores';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import {
  abrirSesion,
  cookieDe,
  encabezadoCookie,
  setCookieDe,
} from '../testing/sesion-de-pruebas';
import { COOKIE_SESION, huellaDeToken } from './sesiones.service';
import type { Express } from 'express';
import type { Redis } from 'ioredis';
import { Limite } from '../limite/limite.decorator';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { leerLimites, limpiarLimites } from '../testing/limites-de-pruebas';

// Prefijo propio: los contadores de límite de esta suite no se mezclan con los
// de otras que corran a la vez ni con los de desarrollo.
const PREFIJO_LIMITE = 'cuadra_test_auth';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * CU-03 y historia 1.1 de punta a punta contra Postgres real y el seed:
 * guards globales, la sesión con cookie de AD-6 (una fila en `sesiones` que
 * rota al elegir empresa) y los roles leídos de la base en cada request.
 */

/** Endpoints de dominio de mentira: aún no existe ninguno real. */
@Controller('prueba')
class ControladorDeDominio {
  @Get('sesion')
  sesion() {
    return { ok: true };
  }

  @Get('admin')
  @Roles('admin')
  admin() {
    return { ok: true };
  }

  @Get('contador-o-revisor')
  @Roles('contador', 'revisor')
  contadorORevisor() {
    return { ok: true };
  }

  @Get('seleccion')
  @Scope('seleccion')
  seleccion() {
    return { ok: true };
  }

  /** Exige sesión y declara límite: prueba que el límite corre antes que el guard de sesión. */
  @Get('limitada')
  @Limite({ intentos: 2, ventanaS: 60 })
  limitada() {
    return { ok: true };
  }
}

const ANA = 'ana.reyes@fdb.mx'; // admin en Ferretería
const JORGE = 'jorge.tapia@despacho.mx'; // contador en Ferretería, revisor en Transportes
const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';

interface EmpresaRespuesta {
  id: string;
  razonSocial: string;
  rfc: string;
  roles: string[];
}

const USUARIO_POR_EMAIL = 'SELECT id FROM users WHERE email = $1';

let app: INestApplication<App>;
/**
 * Dueño del esquema, para preparar datos (revocar un rol, mover el reloj de
 * una sesión). La app corre como cuadra_app, que solo tiene DELETE en
 * `sesiones`.
 */
let ds: DataSource;
const empresas = new Map<string, string>();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({
    ...opcionesDataSource,
    url,
  }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        // Como en producción: la app corre como cuadra_app, no como el dueño.
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      AuthModule,
    ],
    controllers: [ControladorDeDominio],
  }).compile();

  app = modulo.createNestApplication();
  configurarApp(app);
  // Escuchando de una vez: si no, supertest abre y cierra el servidor en
  // cada petición y las anidadas (pedir un token dentro de otra) chocan.
  await app.listen(0);

  for (const rfc of [FERRETERIA, TRANSPORTES]) {
    const { id } = await una<{ id: string }>(
      ds,
      'SELECT id FROM companies WHERE rfc = $1',
      [rfc],
    );
    empresas.set(rfc, id);
  }
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) await ds.destroy();
});

// Casi todos los casos entran por 127.0.0.1: sin esto, los fallos de unos
// agotarían el límite de login de los siguientes. El límite en sí no se toca.
beforeEach(async () => {
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
});

const http = () => request(app.getHttpServer());

/** Inicia sesión y devuelve la cookie de una sesión sin empresa elegida. */
async function tokenSeleccion(email: string): Promise<string> {
  const res = await http()
    .post('/auth/login')
    .send({ email, password: PASSWORD_SEMILLA })
    .expect(200);
  return cookieDe(res);
}

/** Inicia sesión y elige empresa: devuelve la cookie ya rotada. */
async function tokenSesion(email: string, rfc: string): Promise<string> {
  const res = await http()
    .post(`/auth/empresa/${empresas.get(rfc)}`)
    .set('Cookie', await tokenSeleccion(email))
    .expect(200);
  return cookieDe(res);
}

interface FilaSesion {
  id: string;
  user_id: string;
  token_hash: string;
  tipo: string;
  company_id: string | null;
  ultima_actividad: Date;
  expira_en: Date;
}

const valorDe = (cookie: string): string => cookie.split('=')[1];

/** La fila de `sesiones` que corresponde a un encabezado `Cookie`. */
async function filaDe(cookie: string): Promise<FilaSesion | undefined> {
  const filas = await ds.query<FilaSesion[]>(
    'SELECT * FROM sesiones WHERE token_hash = $1',
    [huellaDeToken(valorDe(cookie))],
  );
  return filas[0];
}

describe('POST /auth/login', () => {
  it('devuelve usuario y empresas con rfc y roles, ordenadas, sin token', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: PASSWORD_SEMILLA })
      .expect(200);

    expect(res.body).toEqual({
      usuario: {
        id: (await una<{ id: string }>(ds, USUARIO_POR_EMAIL, [JORGE])).id,
        nombre: 'Jorge Tapia',
        email: JORGE,
      },
      empresas: [
        {
          id: empresas.get(FERRETERIA),
          razonSocial: 'Ferreteria del Bajio SA de CV',
          rfc: FERRETERIA,
          roles: ['contador'],
        },
        {
          id: empresas.get(TRANSPORTES),
          razonSocial: 'Transportes Cuautla SA de CV',
          rfc: TRANSPORTES,
          roles: ['revisor'],
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('abre una fila en sesiones y fija la cookie httpOnly, Secure y SameSite=Lax', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: PASSWORD_SEMILLA })
      .expect(200);

    const fijada = setCookieDe(res) as string;
    expect(fijada).toMatch(/^cuadra_sesion=[A-Za-z0-9_-]{43};/);
    const atributos = fijada.split('; ').map((a) => a.toLowerCase());
    expect(atributos).toEqual(
      expect.arrayContaining([
        'httponly',
        'secure',
        'samesite=lax',
        'path=/',
        `max-age=${8 * 60 * 60}`,
      ]),
    );

    const fila = (await filaDe(cookieDe(res))) as FilaSesion;
    expect(fila).toMatchObject({
      user_id: (await una<{ id: string }>(ds, USUARIO_POR_EMAIL, [JORGE])).id,
      tipo: 'empresa',
      company_id: null,
    });
    expect(fila.expira_en.getTime()).toBeGreaterThan(Date.now());
    // Solo la huella: el token nunca queda en la base ni en el cuerpo.
    expect(fila.token_hash).not.toContain(valorDe(cookieDe(res)));
    expect(JSON.stringify(res.body)).not.toContain(valorDe(cookieDe(res)));
    expect(res.body).not.toHaveProperty('token');
  });

  it('un login fallido ni crea sesión ni fija cookie', async () => {
    const antes = await ds.query<Array<{ n: string }>>(
      'SELECT count(*) AS n FROM sesiones',
    );
    const res = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: 'incorrecta' })
      .expect(401);
    const despues = await ds.query<Array<{ n: string }>>(
      'SELECT count(*) AS n FROM sesiones',
    );

    expect(setCookieDe(res)).toBeUndefined();
    expect(despues[0].n).toBe(antes[0].n);
  });

  it('entrar con una cookie vieja cierra la sesión anterior', async () => {
    const vieja = await tokenSeleccion(JORGE);

    await http()
      .post('/auth/login')
      .set('Cookie', vieja)
      .send({ email: JORGE, password: PASSWORD_SEMILLA })
      .expect(200);

    expect(await filaDe(vieja)).toBeUndefined();
  });

  it('acepta el email en mayúsculas y con espacios, y lo devuelve normalizado', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: '  ANA.REYES@FDB.MX  ', password: PASSWORD_SEMILLA })
      .expect(200);

    const cuerpo = res.body as {
      usuario: { email: string };
      empresas: unknown[];
    };
    expect(cuerpo.empresas).toHaveLength(1);
    expect(cuerpo.usuario.email).toBe(ANA);
  });

  it('con dos roles en la misma empresa los devuelve ambos en orden fijo', async () => {
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol)
       VALUES ((SELECT id FROM users WHERE email = $1), $2, 'revisor')`,
      [JORGE, empresas.get(FERRETERIA)],
    );
    try {
      const res = await http()
        .post('/auth/login')
        .send({ email: JORGE, password: PASSWORD_SEMILLA })
        .expect(200);

      const lista = (res.body as { empresas: EmpresaRespuesta[] }).empresas;
      expect(lista.map((e) => e.rfc)).toEqual([FERRETERIA, TRANSPORTES]);
      expect(lista[0].roles).toEqual(['contador', 'revisor']);
    } finally {
      // `sembrar` no borra: el rol extra se quita a mano.
      await ds.query(
        `DELETE FROM user_company_roles
          WHERE company_id = $1 AND rol = 'revisor'
            AND user_id = (SELECT id FROM users WHERE email = $2)`,
        [empresas.get(FERRETERIA), JORGE],
      );
    }
  });

  it('una empresa desactivada no aparece en la lista', async () => {
    await ds.query('UPDATE companies SET activa = false WHERE rfc = $1', [
      TRANSPORTES,
    ]);
    try {
      const res = await http()
        .post('/auth/login')
        .send({ email: JORGE, password: PASSWORD_SEMILLA })
        .expect(200);

      const lista = (res.body as { empresas: EmpresaRespuesta[] }).empresas;
      expect(lista.map((e) => e.rfc)).toEqual([FERRETERIA]);
    } finally {
      await ds.query('UPDATE companies SET activa = true WHERE rfc = $1', [
        TRANSPORTES,
      ]);
    }
  });

  it('sin empresas vigentes da 403 y sin usuario', async () => {
    await ds.query('UPDATE companies SET activa = false WHERE rfc = $1', [
      FERRETERIA,
    ]);
    try {
      const res = await http()
        .post('/auth/login')
        .send({ email: ANA, password: PASSWORD_SEMILLA })
        .expect(403);

      expect(res.body).not.toHaveProperty('usuario');
      expect((res.body as { message: string }).message).toBe(
        'El usuario no tiene empresas asignadas',
      );
    } finally {
      await ds.query('UPDATE companies SET activa = true WHERE rfc = $1', [
        FERRETERIA,
      ]);
    }
  });

  it('contraseña mala y email inexistente responden igual', async () => {
    const mala = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: 'incorrecta' })
      .expect(401);
    const inexistente = await http()
      .post('/auth/login')
      .send({ email: 'nadie@ejemplo.mx', password: 'incorrecta' })
      .expect(401);

    expect(mala.body).toEqual(inexistente.body);
    expect(Object.keys(inexistente.body as object).sort()).toEqual(
      Object.keys(mala.body as object).sort(),
    );
    expect(mala.body).not.toHaveProperty('usuario');
    expect(mala.body).not.toHaveProperty('empresas');
  });

  it('un usuario inactivo con la contraseña correcta recibe el mismo 401', async () => {
    const mala = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: 'incorrecta' })
      .expect(401);
    await ds.query('UPDATE users SET activo = false WHERE email = $1', [JORGE]);
    try {
      const inactivo = await http()
        .post('/auth/login')
        .send({ email: JORGE, password: PASSWORD_SEMILLA })
        .expect(401);

      expect(inactivo.body).toEqual(mala.body);
    } finally {
      await ds.query('UPDATE users SET activo = true WHERE email = $1', [
        JORGE,
      ]);
    }
  });
});

describe('Origen autorizado (historia 1.2, AD-6)', () => {
  const MALO = 'http://malo.example';
  const alertas = () =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

  afterEach(() => jest.restoreAllMocks());

  it('POST /auth/login con otro origen o sin Origin responde 403 y no consume el límite', async () => {
    alertas();
    const cuerpo = { email: ANA, password: 'incorrecta-1234' };
    for (let i = 0; i < 7; i++) {
      await http()
        .post('/auth/login')
        .set('Origin', MALO)
        .send(cuerpo)
        .expect(403);
      await http().post('/auth/login').unset('Origin').send(cuerpo).expect(403);
    }

    expect(
      await leerLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE),
    ).toEqual({});
    // Con el origen autorizado el contador sigue en cero: un fallo da 401, no 429.
    await http().post('/auth/login').send(cuerpo).expect(401);
  });

  it('un login con otro origen no abre sesión aunque la contraseña sea correcta', async () => {
    alertas();
    const antes = await ds.query<{ n: string }[]>(
      'SELECT count(*)::text AS n FROM sesiones',
    );
    const res = await http()
      .post('/auth/login')
      .set('Origin', MALO)
      .send({ email: ANA, password: PASSWORD_SEMILLA })
      .expect(403);

    expect(setCookieDe(res)).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const despues = await ds.query<{ n: string }[]>(
      'SELECT count(*)::text AS n FROM sesiones',
    );
    expect(despues[0].n).toBe(antes[0].n);
  });

  it('POST /auth/logout con otro origen no borra la sesión', async () => {
    alertas();
    const cookie = await tokenSesion(ANA, FERRETERIA);

    await http()
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', MALO)
      .expect(403);
    await http()
      .post('/auth/logout')
      .set('Cookie', cookie)
      .unset('Origin')
      .expect(403);

    expect(await filaDe(cookie)).toBeDefined();
    await http().get('/auth/contexto').set('Cookie', cookie).expect(200);
  });

  it('elegir empresa con otro origen no rota la sesión', async () => {
    alertas();
    const seleccion = await tokenSeleccion(ANA);

    await http()
      .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
      .set('Cookie', seleccion)
      .set('Origin', MALO)
      .expect(403);

    expect(await filaDe(seleccion)).toBeDefined();
  });

  it('las lecturas no llevan comprobación de origen', async () => {
    const cookie = await tokenSesion(ANA, FERRETERIA);
    await http().get('/auth/contexto').set('Cookie', cookie).expect(200);
  });
});

describe('Límite de intentos de login (historia 1.2)', () => {
  const MAL = { email: ANA, password: 'incorrecta-1234' };
  const BIEN = { email: ANA, password: PASSWORD_SEMILLA };
  const entrar = (cuerpo: object, ip?: string) => {
    const peticion = http().post('/auth/login').send(cuerpo);
    return ip ? peticion.set('X-Forwarded-For', ip) : peticion;
  };
  const alertas = () =>
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

  afterEach(() => jest.restoreAllMocks());

  it('cinco fallos dan 401 y el sexto 429 con Retry-After, sin revelar el correo', async () => {
    const aviso = alertas();
    for (let i = 0; i < 5; i++) await entrar(MAL).expect(401);

    const res = await entrar(MAL).expect(429);

    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(res.text).not.toContain(ANA);
    expect(res.body).toEqual({
      statusCode: 429,
      message: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
      error: 'Too Many Requests',
    });
    // Ni el correo ni la contraseña llegan al registro; ni la clave de Redis.
    const registro = JSON.stringify(aviso.mock.calls);
    expect(registro).not.toContain(ANA);
    expect(registro).not.toContain(MAL.password);
    const llaves = JSON.stringify(
      await leerLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE),
    );
    expect(llaves).not.toContain(ANA);
    // Con el tope gastado ni la contraseña correcta pasa hasta que venza la ventana.
    await entrar(BIEN).expect(429);
  });

  it('un intento correcto no consume: tras 4 fallos y un acierto queda 1 de margen', async () => {
    alertas();
    for (let i = 0; i < 4; i++) await entrar(MAL).expect(401);

    await entrar(BIEN).expect(200);

    const contadores = Object.values(
      await leerLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE),
    );
    expect(contadores).toEqual(['4']);
    await entrar(MAL).expect(401);
    await entrar(MAL).expect(429);
  });

  it('veinte intentos paralelos: como mucho cinco llegan a comprobar la contraseña', async () => {
    alertas();
    const respuestas = await Promise.all(
      Array.from({ length: 20 }, () => entrar(MAL)),
    );
    const estados = respuestas.map((r) => r.status);

    expect(estados.filter((s) => s === 401)).toHaveLength(5);
    expect(estados.filter((s) => s === 429)).toHaveLength(15);
  });

  it('otra IP no se ve afectada con proxy de confianza; sin él la cabecera se ignora', async () => {
    alertas();
    const express = app.getHttpAdapter().getInstance() as Express;

    // Sin proxy de confianza (el valor de la app de pruebas): cambiar la
    // cabecera no da un contador nuevo.
    for (let i = 0; i < 5; i++) await entrar(MAL, '10.0.0.1').expect(401);
    await entrar(MAL, '10.0.0.2').expect(429);

    await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
    express.set('trust proxy', 1);
    try {
      for (let i = 0; i < 5; i++) await entrar(MAL, '10.0.0.1').expect(401);
      await entrar(MAL, '10.0.0.1').expect(429);
      await entrar(MAL, '10.0.0.2').expect(401);
    } finally {
      express.set('trust proxy', false);
    }
  });

  it('el límite corre antes que el guard de sesión, también en rutas no públicas', async () => {
    alertas();
    // Sin cookie, SesionCookieGuard respondería 401 siempre: el 429 solo
    // aparece si el límite se evaluó antes.
    await http().get('/prueba/limitada').expect(401);
    await http().get('/prueba/limitada').expect(401);
    await http().get('/prueba/limitada').expect(429);
  });
});

describe('GET /auth/empresas', () => {
  it('devuelve la misma lista que el login, arreglo plano con rfc y roles', async () => {
    const login = await http()
      .post('/auth/login')
      .send({ email: JORGE, password: PASSWORD_SEMILLA })
      .expect(200);
    const { empresas: delLogin } = login.body as {
      empresas: EmpresaRespuesta[];
    };

    const res = await http()
      .get('/auth/empresas')
      .set('Cookie', cookieDe(login))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(delLogin);
    expect(delLogin.map((e) => [e.rfc, e.roles])).toEqual([
      [FERRETERIA, ['contador']],
      [TRANSPORTES, ['revisor']],
    ]);
  });

  it('un rol revocado deja de aparecer en la lista', async () => {
    const token = await tokenSeleccion(JORGE);
    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), JORGE],
    );
    try {
      const res = await http()
        .get('/auth/empresas')
        .set('Cookie', token)
        .expect(200);

      expect((res.body as EmpresaRespuesta[]).map((e) => e.rfc)).toEqual([
        TRANSPORTES,
      ]);
    } finally {
      await sembrar(ds);
    }
  });

  it('una lectura correcta no escribe en la bitácora', async () => {
    await ds.query('TRUNCATE bitacora');
    await http()
      .get('/auth/empresas')
      .set('Cookie', await tokenSeleccion(JORGE))
      .expect(200);

    expect(await ds.query('SELECT 1 FROM bitacora')).toHaveLength(0);
  });

  it('una sesión con empresa elegida recibe la misma lista', async () => {
    const seleccion = await http()
      .get('/auth/empresas')
      .set('Cookie', await tokenSeleccion(JORGE))
      .expect(200);
    const res = await http()
      .get('/auth/empresas')
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(200);

    expect(res.body).toEqual(seleccion.body);
    expect((res.body as EmpresaRespuesta[]).map((e) => e.rfc)).toEqual([
      FERRETERIA,
      TRANSPORTES,
    ]);
  });

  it('con empresa elegida sigue respondiendo aunque ya no tenga rol en ella', async () => {
    const token = await tokenSesion(JORGE, FERRETERIA);
    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), JORGE],
    );
    try {
      const res = await http()
        .get('/auth/empresas')
        .set('Cookie', token)
        .expect(200);
      expect((res.body as EmpresaRespuesta[]).map((e) => e.rfc)).toEqual([
        TRANSPORTES,
      ]);
    } finally {
      await sembrar(ds);
    }
  });
});

describe('GET /auth/contexto', () => {
  interface Contexto {
    usuario: { id: string; nombre: string; email: string };
    empresa: { id: string; razonSocial: string; rfc: string };
    roles: string[];
  }

  const contexto = (token: string, ruta = '/auth/contexto') =>
    http().get(ruta).set('Cookie', token);

  // La base se comparte: una fila de bitácora rompería el `down` de otros specs.
  afterAll(() => ds.query('TRUNCATE bitacora'));
  beforeEach(() => ds.query('TRUNCATE bitacora'));

  it('con la sesión con empresa devuelve usuario, empresa con rfc y roles, sin passwordHash', async () => {
    const res = await contexto(await tokenSesion(JORGE, FERRETERIA)).expect(
      200,
    );

    expect(res.body).toEqual({
      usuario: {
        id: (await una<{ id: string }>(ds, USUARIO_POR_EMAIL, [JORGE])).id,
        nombre: 'Jorge Tapia',
        email: JORGE,
      },
      empresa: {
        id: empresas.get(FERRETERIA),
        razonSocial: 'Ferreteria del Bajio SA de CV',
        rfc: FERRETERIA,
      },
      roles: ['contador'],
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('un miembro solo revisor también puede leerlo (sin @Roles)', async () => {
    const res = await contexto(await tokenSesion(JORGE, TRANSPORTES)).expect(
      200,
    );

    expect((res.body as Contexto).roles).toEqual(['revisor']);
  });

  it('con dos roles los devuelve en orden fijo', async () => {
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol)
       VALUES ((SELECT id FROM users WHERE email = $1), $2, 'admin')`,
      [JORGE, empresas.get(FERRETERIA)],
    );
    try {
      const res = await contexto(await tokenSesion(JORGE, FERRETERIA)).expect(
        200,
      );

      expect((res.body as Contexto).roles).toEqual(['admin', 'contador']);
    } finally {
      await ds.query(
        `DELETE FROM user_company_roles
          WHERE company_id = $1 AND rol = 'admin'
            AND user_id = (SELECT id FROM users WHERE email = $2)`,
        [empresas.get(FERRETERIA), JORGE],
      );
    }
  });

  it('rechaza la sesión sin empresa, sin cookie y con un token inventado', async () => {
    await contexto(await tokenSeleccion(JORGE)).expect(401);
    await http().get('/auth/contexto').expect(401);
    await contexto(encabezadoCookie('no-existe-en-la-base')).expect(401);
    await contexto('otra_cookie=valor').expect(401);
  });

  it('solo describe la empresa de la sesión', async () => {
    const enFerreteria = await contexto(
      await tokenSesion(JORGE, FERRETERIA),
    ).expect(200);
    const enTransportes = await contexto(
      await tokenSesion(JORGE, TRANSPORTES),
    ).expect(200);

    expect(enFerreteria.body).toMatchObject({
      empresa: { rfc: FERRETERIA },
      roles: ['contador'],
    });
    expect(enTransportes.body).toMatchObject({
      empresa: { rfc: TRANSPORTES },
      roles: ['revisor'],
    });
  });

  it('ignora un id de empresa inyectado por query o header', async () => {
    const token = await tokenSesion(JORGE, FERRETERIA);
    const otra = empresas.get(TRANSPORTES) as string;

    const res = await http()
      .get(`/auth/contexto?companyId=${otra}`)
      .set('x-company-id', otra)
      .set('Cookie', token)
      .expect(200);

    expect(res.body).toMatchObject({
      empresa: { rfc: FERRETERIA },
      roles: ['contador'],
    });
  });

  it('refleja al instante un cambio de razón social', async () => {
    const token = await tokenSesion(JORGE, FERRETERIA);
    await ds.query(
      `UPDATE companies SET razon_social = 'Ferreteria Renombrada SA' WHERE rfc = $1`,
      [FERRETERIA],
    );
    try {
      const res = await contexto(token).expect(200);

      expect((res.body as Contexto).empresa.razonSocial).toBe(
        'Ferreteria Renombrada SA',
      );
    } finally {
      await sembrar(ds);
    }
  });

  it('da 403 y deja fila en la bitácora al revocar el rol con el mismo token', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    await contexto(token).expect(200);
    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), ANA],
    );
    try {
      await contexto(token).expect(403);
    } finally {
      await sembrar(ds);
    }

    const filas = await ds.query<Array<{ accion: string; datos: object }>>(
      'SELECT accion, datos FROM bitacora',
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      accion: 'acceso_denegado',
      datos: { ruta: '/auth/contexto', motivo: 'sin_membresia' },
    });
  });

  it('da 403 con el usuario desactivado y con la empresa desactivada', async () => {
    const token = await tokenSesion(JORGE, FERRETERIA);
    await ds.query('UPDATE users SET activo = false WHERE email = $1', [JORGE]);
    try {
      await contexto(token).expect(403);
    } finally {
      await ds.query('UPDATE users SET activo = true WHERE email = $1', [
        JORGE,
      ]);
    }
    await ds.query('UPDATE companies SET activa = false WHERE rfc = $1', [
      FERRETERIA,
    ]);
    try {
      await contexto(token).expect(403);
    } finally {
      await ds.query('UPDATE companies SET activa = true WHERE rfc = $1', [
        FERRETERIA,
      ]);
    }
  });

  it('una lectura correcta no escribe en la bitácora', async () => {
    await contexto(await tokenSesion(JORGE, FERRETERIA)).expect(200);

    expect(await ds.query('SELECT 1 FROM bitacora')).toHaveLength(0);
  });
});

describe('POST /auth/empresa/:id', () => {
  it('actualiza la misma fila con la empresa y rota el token', async () => {
    const seleccion = await tokenSeleccion(JORGE);
    const antes = (await filaDe(seleccion)) as FilaSesion;
    expect(antes.company_id).toBeNull();

    const res = await http()
      .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
      .set('Cookie', seleccion)
      .expect(200);

    const rotada = cookieDe(res);
    expect(rotada).not.toBe(seleccion);
    const despues = (await filaDe(rotada)) as FilaSesion;
    expect(despues).toMatchObject({
      id: antes.id,
      user_id: antes.user_id,
      company_id: empresas.get(TRANSPORTES),
    });
    expect(despues.token_hash).not.toBe(antes.token_hash);
    expect(await filaDe(seleccion)).toBeUndefined();
    // Las mismas banderas en la cookie rotada; el cuerpo es el contexto.
    expect((setCookieDe(res) as string).toLowerCase()).toEqual(
      expect.stringContaining('httponly; secure; samesite=lax'),
    );
    expect(res.body).toMatchObject({
      empresa: { rfc: TRANSPORTES },
      roles: ['revisor'],
    });
    expect(JSON.stringify(res.body)).not.toContain(valorDe(rotada));
  });

  it('el token anterior ya no sirve y el nuevo sí', async () => {
    const seleccion = await tokenSeleccion(JORGE);
    const res = await http()
      .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
      .set('Cookie', seleccion)
      .expect(200);

    await http().get('/auth/empresas').set('Cookie', seleccion).expect(401);
    await http()
      .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
      .set('Cookie', seleccion)
      .expect(401);
    await http().get('/auth/contexto').set('Cookie', cookieDe(res)).expect(200);
  });

  it('da 403 con una empresa que no es suya y la sesión queda igual', async () => {
    const seleccion = await tokenSeleccion(ANA);
    const antes = (await filaDe(seleccion)) as FilaSesion;

    const res = await http()
      .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
      .set('Cookie', seleccion)
      .expect(403);

    // La petición autenticada renueva la actividad y re-emite el mismo
    // token; lo que no cambia es la empresa ni el token.
    expect(cookieDe(res)).toBe(seleccion);
    const despues = (await filaDe(seleccion)) as FilaSesion;
    expect(despues).toMatchObject({
      id: antes.id,
      token_hash: antes.token_hash,
      company_id: null,
    });
    // Sigue siendo una sesión sin empresa: aún puede elegir una suya.
    await http()
      .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
      .set('Cookie', seleccion)
      .expect(200);
  });

  it('da 400 si el id no es un UUID', async () => {
    await http()
      .post('/auth/empresa/no-es-uuid')
      .set('Cookie', await tokenSeleccion(ANA))
      .expect(400);
  });

  describe('con la sesión viva (cambiar de empresa)', () => {
    it('actualiza la misma fila, rota el token y el contexto es el de la nueva empresa', async () => {
      const enFerreteria = await tokenSesion(JORGE, FERRETERIA);
      const antes = (await filaDe(enFerreteria)) as FilaSesion;
      expect(antes.company_id).toBe(empresas.get(FERRETERIA));

      const res = await http()
        .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
        .set('Cookie', enFerreteria)
        .expect(200);

      const rotada = cookieDe(res);
      expect(rotada).not.toBe(enFerreteria);
      const despues = (await filaDe(rotada)) as FilaSesion;
      expect(despues).toMatchObject({
        id: antes.id,
        user_id: antes.user_id,
        company_id: empresas.get(TRANSPORTES),
      });
      expect(despues.token_hash).not.toBe(antes.token_hash);
      expect(await filaDe(enFerreteria)).toBeUndefined();
      expect((setCookieDe(res) as string).toLowerCase()).toEqual(
        expect.stringContaining('httponly; secure; samesite=lax'),
      );
      expect(res.body).toMatchObject({
        empresa: { rfc: TRANSPORTES },
        roles: ['revisor'],
      });

      // El token anterior muere de inmediato y el nuevo ve la empresa nueva.
      await http()
        .get('/auth/contexto')
        .set('Cookie', enFerreteria)
        .expect(401);
      const contexto = await http()
        .get('/auth/contexto')
        .set('Cookie', rotada)
        .expect(200);
      expect(contexto.body).toMatchObject({
        empresa: { rfc: TRANSPORTES },
        roles: ['revisor'],
      });
    });

    it('da 403 con una empresa sin rol y la sesión queda exactamente igual', async () => {
      const enFerreteria = await tokenSesion(ANA, FERRETERIA);
      const antes = (await filaDe(enFerreteria)) as FilaSesion;

      await http()
        .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
        .set('Cookie', enFerreteria)
        .expect(403);

      const despues = (await filaDe(enFerreteria)) as FilaSesion;
      expect(despues).toMatchObject({
        id: antes.id,
        token_hash: antes.token_hash,
        company_id: empresas.get(FERRETERIA),
      });
      // El token viejo sigue sirviendo y sigue en Ferretería.
      const contexto = await http()
        .get('/auth/contexto')
        .set('Cookie', enFerreteria)
        .expect(200);
      expect(contexto.body).toMatchObject({ empresa: { rfc: FERRETERIA } });
    });

    it('elegir la empresa que ya está activa es inofensivo', async () => {
      const enFerreteria = await tokenSesion(JORGE, FERRETERIA);
      const res = await http()
        .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
        .set('Cookie', enFerreteria)
        .expect(200);

      expect(res.body).toMatchObject({
        empresa: { rfc: FERRETERIA },
        roles: ['contador'],
      });
      await http()
        .get('/auth/contexto')
        .set('Cookie', cookieDe(res))
        .expect(200);
    });

    it('con un id de empresa de otro usuario da 403 y no cambia nada', async () => {
      // Ana no tiene rol en Transportes; Jorge sí: el id es válido pero ajeno.
      const enFerreteria = await tokenSesion(ANA, FERRETERIA);
      await http()
        .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
        .set('Cookie', enFerreteria)
        .expect(403);
      const fila = (await filaDe(enFerreteria)) as FilaSesion;
      expect(fila.company_id).toBe(empresas.get(FERRETERIA));
    });

    it('cambia de empresa aunque ya haya perdido el rol en la actual', async () => {
      const token = await tokenSesion(JORGE, FERRETERIA);
      await ds.query(
        `DELETE FROM user_company_roles
          WHERE company_id = $1
            AND user_id = (SELECT id FROM users WHERE email = $2)`,
        [empresas.get(FERRETERIA), JORGE],
      );
      try {
        const res = await http()
          .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
          .set('Cookie', token)
          .expect(200);
        expect(res.body).toMatchObject({ empresa: { rfc: TRANSPORTES } });
      } finally {
        await sembrar(ds);
      }
    });

    it('dos sesiones del mismo usuario son independientes', async () => {
      const a = await tokenSesion(JORGE, FERRETERIA);
      const b = await tokenSesion(JORGE, FERRETERIA);
      const resB = await http()
        .post(`/auth/empresa/${empresas.get(TRANSPORTES)}`)
        .set('Cookie', b)
        .expect(200);

      const contextoA = await http()
        .get('/auth/contexto')
        .set('Cookie', a)
        .expect(200);
      expect(contextoA.body).toMatchObject({ empresa: { rfc: FERRETERIA } });
      const contextoB = await http()
        .get('/auth/contexto')
        .set('Cookie', cookieDe(resB))
        .expect(200);
      expect(contextoB.body).toMatchObject({ empresa: { rfc: TRANSPORTES } });
    });
  });

  it('rechaza sin cookie', async () => {
    await http()
      .post(`/auth/empresa/${empresas.get(FERRETERIA)}`)
      .expect(401);
  });
});

describe('POST /auth/logout', () => {
  it('borra la fila, limpia la cookie y el mismo token responde 401 al instante', async () => {
    const cookie = await tokenSesion(ANA, FERRETERIA);
    await http().get('/auth/contexto').set('Cookie', cookie).expect(200);

    const res = await http()
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    expect(await filaDe(cookie)).toBeUndefined();
    expect(setCookieDe(res)).toMatch(/^cuadra_sesion=;.*Expires=/);
    await http().get('/auth/contexto').set('Cookie', cookie).expect(401);
  });

  it('también cierra una sesión sin empresa elegida', async () => {
    const cookie = await tokenSeleccion(ANA);
    await http().post('/auth/logout').set('Cookie', cookie).expect(204);

    expect(await filaDe(cookie)).toBeUndefined();
    await http().get('/auth/empresas').set('Cookie', cookie).expect(401);
  });

  it('es idempotente: sin cookie o con una ya cerrada responde 204', async () => {
    const cookie = await tokenSesion(ANA, FERRETERIA);
    await http().post('/auth/logout').set('Cookie', cookie).expect(204);
    await http().post('/auth/logout').set('Cookie', cookie).expect(204);
    await http().post('/auth/logout').expect(204);
  });

  it('solo cierra su propia sesión', async () => {
    const mia = await tokenSesion(ANA, FERRETERIA);
    const otra = await tokenSesion(ANA, FERRETERIA);

    await http().post('/auth/logout').set('Cookie', mia).expect(204);

    await http().get('/auth/contexto').set('Cookie', otra).expect(200);
  });
});

describe('Sesión con cookie (AD-6)', () => {
  const ocho = (cookie: string, horas: number) =>
    ds.query(
      `UPDATE sesiones
          SET ultima_actividad = now() - make_interval(hours => $2),
              expira_en = now() - make_interval(hours => $2)
                          + interval '8 hours'
        WHERE token_hash = $1`,
      [huellaDeToken(valorDe(cookie)), horas],
    );

  it('recargar con la misma cookie sigue dentro, sin pedir la contraseña', async () => {
    const cookie = await tokenSesion(JORGE, FERRETERIA);

    for (let i = 0; i < 2; i++) {
      const res = await http()
        .get('/auth/contexto')
        .set('Cookie', cookie)
        .expect(200);
      expect(res.body).toMatchObject({ usuario: { email: JORGE } });
    }
  });

  it('tras 8 horas de inactividad responde 401 y no la renueva', async () => {
    const cookie = await tokenSesion(JORGE, FERRETERIA);
    await ocho(cookie, 9);
    const antes = (await filaDe(cookie)) as FilaSesion;

    const res = await http()
      .get('/auth/contexto')
      .set('Cookie', cookie)
      .expect(401);

    expect(setCookieDe(res)).toBeUndefined();
    const despues = (await filaDe(cookie)) as FilaSesion;
    expect(despues.expira_en).toEqual(antes.expira_en);
    expect(despues.ultima_actividad).toEqual(antes.ultima_actividad);
  });

  it('una petición antes de las 8 horas renueva el vencimiento y la cookie', async () => {
    const cookie = await tokenSesion(JORGE, FERRETERIA);
    await ocho(cookie, 7);
    const antes = (await filaDe(cookie)) as FilaSesion;

    const res = await http()
      .get('/auth/contexto')
      .set('Cookie', cookie)
      .expect(200);

    const despues = (await filaDe(cookie)) as FilaSesion;
    expect(despues.expira_en.getTime()).toBeGreaterThan(
      antes.expira_en.getTime() + 6 * 60 * 60 * 1000,
    );
    expect(despues.ultima_actividad.getTime()).toBeGreaterThan(
      antes.ultima_actividad.getTime(),
    );
    // Misma cookie, Max-Age nuevo.
    expect(setCookieDe(res)).toEqual(
      expect.stringContaining(`${COOKIE_SESION}=${valorDe(cookie)};`),
    );
    expect((setCookieDe(res) as string).toLowerCase()).toContain(
      `max-age=${8 * 60 * 60}`,
    );
  });

  it('una petición rechazada por scope no renueva la sesión', async () => {
    const cookie = await tokenSeleccion(ANA);
    await ocho(cookie, 4);
    const antes = (await filaDe(cookie)) as FilaSesion;

    await http().get('/prueba/sesion').set('Cookie', cookie).expect(401);

    expect(await filaDe(cookie)).toEqual(antes);
  });
});

describe('SesionCookieGuard', () => {
  it('un endpoint de dominio rechaza la sesión sin empresa', async () => {
    await http()
      .get('/prueba/sesion')
      .set('Cookie', await tokenSeleccion(ANA))
      .expect(401);
  });

  it('un endpoint @Scope("seleccion") la acepta', async () => {
    await http()
      .get('/prueba/seleccion')
      .set('Cookie', await tokenSeleccion(ANA))
      .expect(200);
  });

  it('un endpoint @Scope("seleccion") rechaza la sesión con empresa', async () => {
    await http()
      .get('/prueba/seleccion')
      .set('Cookie', await tokenSesion(ANA, FERRETERIA))
      .expect(401);
  });

  it('rechaza un Bearer aunque sea un token de sesión válido', async () => {
    const cookie = await tokenSesion(ANA, FERRETERIA);
    await http()
      .get('/prueba/sesion')
      .set('Authorization', `Bearer ${valorDe(cookie)}`)
      .expect(401);
  });

  it('rechaza una sesión de tipo plataforma, que aún no opera', async () => {
    const usuario = await una<{ id: string }>(ds, USUARIO_POR_EMAIL, [ANA]);
    const cookie = await abrirSesion(ds, usuario.id, null);
    const dueno = await una<{ id: string }>(
      ds,
      `INSERT INTO plataforma_usuarios (correo, password_hash)
       VALUES ('dueno-sesion@cuadra.test', 'hash') RETURNING id`,
    );
    // El CHECK de sujeto por tipo exige un solo sujeto: se pasa de usuario de
    // empresa a cuenta de plataforma en la misma sentencia.
    await ds.query(
      `UPDATE sesiones SET tipo = 'plataforma', user_id = NULL,
              company_id = NULL, plataforma_usuario_id = $2
        WHERE token_hash = $1`,
      [huellaDeToken(valorDe(cookie)), dueno.id],
    );

    await http().get('/prueba/seleccion').set('Cookie', cookie).expect(401);
  });
});

describe('RolesGuard', () => {
  it('autoriza cuando su rol está en la lista', async () => {
    await http()
      .get('/prueba/contador-o-revisor')
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(200);
  });

  it('da 403 cuando su rol no alcanza', async () => {
    await http()
      .get('/prueba/admin')
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(403);
  });

  it('revocar el rol surte efecto con la misma sesión (AD-6)', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    await http().get('/prueba/admin').set('Cookie', token).expect(200);

    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), ANA],
    );
    try {
      await http().get('/prueba/admin').set('Cookie', token).expect(403);
      await http().get('/prueba/sesion').set('Cookie', token).expect(403);
    } finally {
      await sembrar(ds);
    }
  });
});

/** CU-03.3: el 403 por rol deja rastro en la bitácora de su empresa. */
describe('Bitácora de accesos denegados', () => {
  interface FilaBitacora {
    company_id: string;
    user_id: string;
    entidad: string;
    entidad_id: string;
    accion: string;
    datos: Record<string, unknown>;
  }

  const SELECT = `SELECT company_id, user_id, entidad, entidad_id, accion, datos
                    FROM bitacora`;

  // La base de pruebas se comparte: una fila 'acceso_denegado' haría fallar
  // el `down` de la migración en los specs que la revierten.
  afterAll(() => ds.query('TRUNCATE bitacora'));

  beforeEach(async () => {
    // Dueño de la tabla: la app no puede borrar bitácora.
    await ds.query('TRUNCATE bitacora');
  });

  it('un 403 por rol crea exactamente una fila con empresa y usuario', async () => {
    await http()
      .get('/prueba/admin')
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(403);

    const usuario = await una<{ id: string }>(
      ds,
      'SELECT id FROM users WHERE email = $1',
      [JORGE],
    );
    const filas = await ds.query<FilaBitacora[]>(SELECT);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      company_id: empresas.get(FERRETERIA),
      user_id: usuario.id,
      entidad: 'companies',
      entidad_id: empresas.get(FERRETERIA),
      accion: 'acceso_denegado',
      datos: {
        metodo: 'GET',
        ruta: '/prueba/admin',
        motivo: 'rol_insuficiente',
        rolesRequeridos: ['admin'],
        rolesDelUsuario: ['contador'],
      },
    });
  });

  it('otra empresa no ve esa fila (RLS), la suya sí', async () => {
    await http()
      .get('/prueba/admin')
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(403);

    const transaccion = app.get(TransaccionEmpresa);
    const desde = (rfc: string) =>
      transaccion.ejecutar(empresas.get(rfc) ?? rfc, (manager) =>
        filas<FilaBitacora>(manager, SELECT),
      );
    expect(await desde(TRANSPORTES)).toHaveLength(0);
    expect(await desde(FERRETERIA)).toHaveLength(1);
  });

  it('sin membresía vigente se registra en la empresa de la sesión', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    await ds.query(
      `DELETE FROM user_company_roles
        WHERE company_id = $1
          AND user_id = (SELECT id FROM users WHERE email = $2)`,
      [empresas.get(FERRETERIA), ANA],
    );
    try {
      await http().get('/prueba/sesion').set('Cookie', token).expect(403);
    } finally {
      await sembrar(ds);
    }

    const filas = await ds.query<FilaBitacora[]>(SELECT);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      company_id: empresas.get(FERRETERIA),
      datos: { motivo: 'sin_membresia', rolesDelUsuario: [] },
    });
  });

  it('un acceso permitido no escribe nada', async () => {
    await http()
      .get('/prueba/contador-o-revisor')
      .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
      .expect(200);
    expect(await ds.query(SELECT)).toHaveLength(0);
  });

  it('si la bitácora falla, la respuesta sigue siendo 403', async () => {
    const espia = jest
      .spyOn(TransaccionEmpresa.prototype, 'ejecutar')
      .mockRejectedValue(new Error('base caída'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await http()
        .get('/prueba/admin')
        .set('Cookie', await tokenSesion(JORGE, FERRETERIA))
        .expect(403);
      expect(espia).toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
    }
    expect(await ds.query(SELECT)).toHaveLength(0);
  });
});
