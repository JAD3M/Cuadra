import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
import { CorreoSimulado } from '../correo/correo-simulado';
import { ProveedorCorreo } from '../correo/proveedor-correo';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import { abrirSesion, setCookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';

const PREFIJO_LIMITE = 'cuadra_test_recuperacion';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 1.6 (FR-43, AD-14): recuperar la contraseña por correo. Postgres y
 * Redis reales; la app corre como cuadra_app y el correo es el simulado.
 */

const DOMINIO = 'recuperacion.test';
const CORREO_DUENO = 'dueno-recupera@cuadra.test';
const PASSWORD_VIEJA = 'contraseña-vieja-segura';
const PASSWORD_NUEVA = 'contraseña-nueva-segura';
const FERRETERIA = 'FDB190215QK4';
const RFC_EMPRESA = 'REC240101AB1';

let app: INestApplication<App>;
let ds: DataSource;
let correo: CorreoSimulado;
let ferreteriaId: string;
let empresaId: string;
let duenoId: string;
let contador = 0;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  ferreteriaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM companies WHERE rfc = $1', [
      FERRETERIA,
    ])
  ).id;
  empresaId = (
    await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ($1, 'Recuperadora SA de CV')
       ON CONFLICT (rfc) DO UPDATE SET razon_social = 'Recuperadora SA de CV'
       RETURNING id`,
      [RFC_EMPRESA],
    )
  ).id;

  const hash = await new PasswordHasher().hashear(PASSWORD_VIEJA);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hash],
  );
  duenoId = (
    await una<{ id: string }>(
      ds,
      'SELECT id FROM plataforma_usuarios WHERE correo = $1',
      [CORREO_DUENO],
    )
  ).id;

  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: urlAppDePruebas(),
        entities: ENTIDADES,
        namingStrategy: new SnakeNamingStrategy(),
      }),
      AuthModule,
    ],
  }).compile();
  app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
  correo = app.get(ProveedorCorreo, { strict: false });
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    await ds.query(
      `DELETE FROM tokens_recuperacion WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}') OR plataforma_usuario_id = $1`,
      [duenoId],
    );
    await ds.query(
      `DELETE FROM sesiones WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}') OR plataforma_usuario_id = $1`,
      [duenoId],
    );
    await ds.query(
      `DELETE FROM bitacora WHERE entidad_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(`DELETE FROM bitacora_plataforma`);
    await ds.query(
      `DELETE FROM user_company_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    await ds.query(`DELETE FROM companies WHERE id = $1`, [empresaId]);
    await ds.query(`DELETE FROM plataforma_usuarios WHERE correo = $1`, [
      CORREO_DUENO,
    ]);
    await ds.destroy();
  }
});

beforeEach(async () => {
  correo.limpiar();
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
});

afterEach(() => jest.restoreAllMocks());

const http = () => request(app.getHttpServer());

/** Persona con rol en las dos empresas, lista para entrar con PASSWORD_VIEJA. */
async function personaNueva(activo = true): Promise<{
  id: string;
  email: string;
}> {
  contador += 1;
  const email = `persona${contador}@${DOMINIO}`;
  const hash = await new PasswordHasher().hashear(PASSWORD_VIEJA);
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO users (email, nombre, password_hash, activo)
     VALUES ($1, 'Persona de prueba', $2, $3) RETURNING id`,
    [email, hash, activo],
  );
  for (const companyId of [ferreteriaId, empresaId]) {
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol) VALUES ($1, $2, 'contador')`,
      [id, companyId],
    );
  }
  return { id, email };
}

const pedir = (email: string) =>
  http().post('/auth/recuperacion').send({ email });
const consultar = (token: string) => http().get(`/auth/recuperacion/${token}`);
const restablecer = (token: string, password: string = PASSWORD_NUEVA) =>
  http().post(`/auth/recuperacion/${token}`).send({ password });

/** Token del último correo enviado a `para`. */
function tokenDe(para: string): string {
  const mensaje = correo.ultimoPara(para);
  const m = /\/recuperar\/([A-Za-z0-9_-]+)/.exec(mensaje?.texto ?? '');
  if (!m) throw new Error(`No hubo correo con enlace para ${para}`);
  return m[1];
}

const loginEmpresa = (email: string, password: string) =>
  http().post('/auth/login').send({ email, password });
const loginDueno = (password: string) =>
  http().post('/plataforma/auth/login').send({ email: CORREO_DUENO, password });

async function tokensDe(userId: string) {
  return await filas<{
    consumida: boolean;
    reemplazada: boolean;
    horas: number;
    tokenHash: string;
  }>(
    ds,
    `SELECT consumida_en IS NOT NULL AS consumida, reemplazada_en IS NOT NULL AS reemplazada,
            extract(epoch FROM expires_at - created_at) / 3600 AS horas,
            token_hash AS "tokenHash"
       FROM tokens_recuperacion WHERE user_id = $1 ORDER BY created_at, id`,
    [userId],
  );
}

describe('POST /auth/recuperacion', () => {
  it('con cuenta: responde 200, guarda solo el hash (1 hora) y envía el enlace', async () => {
    const { id, email } = await personaNueva();
    const res = await pedir(email).expect(200);
    expect(res.body).toEqual({ mensaje: expect.any(String) as string });

    const token = tokenDe(email);
    const origen = process.env.ORIGEN_AUTORIZADO;
    expect(correo.ultimoPara(email)?.texto).toContain(
      `${origen}/recuperar/${token}`,
    );
    const [fila] = await tokensDe(id);
    expect(fila.consumida).toBe(false);
    expect(fila.reemplazada).toBe(false);
    expect(Number(fila.horas)).toBeCloseTo(1, 3);
    expect(fila.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fila.tokenHash).not.toBe(token);
  });

  it('normaliza el correo antes de buscar la cuenta', async () => {
    const { email } = await personaNueva();
    await pedir(`  ${email.toUpperCase()} `).expect(200);
    expect(correo.ultimoPara(email)).toBeDefined();
  });

  it('responde idéntico con cuenta, sin cuenta e inactiva, y solo envía a la activa', async () => {
    const activa = await personaNueva();
    const inactiva = await personaNueva(false);
    const a = await pedir(activa.email).expect(200);
    const b = await pedir(`nadie@${DOMINIO}`).expect(200);
    const c = await pedir(inactiva.email).expect(200);
    expect(b.body).toEqual(a.body);
    expect(c.body).toEqual(a.body);
    expect(correo.enviados.map((m) => m.para)).toEqual([activa.email]);
    expect(await tokensDe(inactiva.id)).toEqual([]);
  });

  it('un fallo de envío no cambia la respuesta', async () => {
    const { email } = await personaNueva();
    jest.spyOn(correo, 'enviar').mockRejectedValue(new Error('smtp caído'));
    const res = await pedir(email).expect(200);
    expect(res.body).toEqual({ mensaje: expect.any(String) as string });
  });

  it('un correo mal formado es 400', async () => {
    await pedir('no-es-correo').expect(400);
  });

  it('pedir otro enlace deja inservible el anterior', async () => {
    const { id, email } = await personaNueva();
    await pedir(email).expect(200);
    const viejo = tokenDe(email);
    await pedir(email).expect(200);
    const nuevo = tokenDe(email);
    expect(nuevo).not.toBe(viejo);

    const filasToken = await tokensDe(id);
    expect(filasToken.map((f) => f.reemplazada)).toEqual([true, false]);
    expect((await consultar(viejo).expect(200)).body).toEqual({
      estado: 'invalida',
      motivo: 'reemplazada',
    });
    const res = await restablecer(viejo).expect(410);
    expect(res.body).toMatchObject({ motivo: 'reemplazada' });
    await restablecer(nuevo).expect(200);
  });

  it('aplica el límite de la ruta (429 con Retry-After)', async () => {
    for (let i = 0; i < 5; i++) {
      await pedir(`nadie${i}@${DOMINIO}`).expect(200);
    }
    const res = await pedir(`nadie@${DOMINIO}`).expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('GET /auth/recuperacion/:token', () => {
  it('vigente, y sin datos de la cuenta', async () => {
    const { email } = await personaNueva();
    await pedir(email).expect(200);
    const res = await consultar(tokenDe(email)).expect(200);
    expect(res.body).toEqual({ estado: 'vigente', motivo: null });
  });

  it('desconocido, usado y caducado son 200 con su motivo', async () => {
    const { id, email } = await personaNueva();
    expect((await consultar('z'.repeat(43)).expect(200)).body).toEqual({
      estado: 'invalida',
      motivo: 'desconocida',
    });
    await pedir(email).expect(200);
    const token = tokenDe(email);
    await ds.query(
      `UPDATE tokens_recuperacion SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [id],
    );
    expect((await consultar(token).expect(200)).body).toEqual({
      estado: 'invalida',
      motivo: 'caducada',
    });
    await ds.query(
      `UPDATE tokens_recuperacion SET expires_at = now() + interval '1 hour' WHERE user_id = $1`,
      [id],
    );
    await restablecer(token).expect(200);
    expect((await consultar(token).expect(200)).body).toEqual({
      estado: 'invalida',
      motivo: 'usada',
    });
  });
});

describe('POST /auth/recuperacion/:token (empresa)', () => {
  it('cambia la contraseña, consume el enlace, borra todas las sesiones y no abre una', async () => {
    const { id, email } = await personaNueva();
    await abrirSesion(ds, id, ferreteriaId);
    await abrirSesion(ds, id, null);
    await pedir(email).expect(200);
    const token = tokenDe(email);

    const res = await restablecer(token).expect(200);
    expect(res.body).toEqual({ mensaje: expect.any(String) as string });
    expect(setCookieDe(res)).toBeUndefined();

    const { n } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM sesiones WHERE user_id = $1`,
      [id],
    );
    expect(n).toBe(0);
    expect((await tokensDe(id))[0].consumida).toBe(true);

    await loginEmpresa(email, PASSWORD_VIEJA).expect(401);
    await loginEmpresa(email, PASSWORD_NUEVA).expect(200);
  });

  it('registra en la bitácora una fila por empresa, sin token ni contraseña', async () => {
    const { id, email } = await personaNueva();
    await pedir(email).expect(200);
    const token = tokenDe(email);
    await restablecer(token).expect(200);

    const filasBitacora = await filas<{
      companyId: string;
      userId: string;
      entidad: string;
      accion: string;
      datos: unknown;
    }>(
      ds,
      `SELECT company_id AS "companyId", user_id AS "userId", entidad, accion, datos
         FROM bitacora WHERE entidad_id = $1 ORDER BY company_id`,
      [id],
    );
    expect(filasBitacora.map((f) => f.companyId).sort()).toEqual(
      [ferreteriaId, empresaId].sort(),
    );
    for (const f of filasBitacora) {
      expect(f).toMatchObject({
        userId: id,
        entidad: 'users',
        accion: 'actualizar',
        datos: { campo: 'password_hash' },
      });
    }
    const crudo = JSON.stringify(filasBitacora);
    expect(crudo).not.toContain(token);
    expect(crudo).not.toContain(PASSWORD_NUEVA);
  });

  it('un enlace usado se rechaza con 410 y no cambia nada', async () => {
    const { email } = await personaNueva();
    await pedir(email).expect(200);
    const token = tokenDe(email);
    await restablecer(token).expect(200);

    const res = await restablecer(token, 'otra-contraseña-distinta').expect(
      410,
    );
    expect(res.body).toMatchObject({
      motivo: 'usada',
      message: expect.stringContaining('ya se usó') as string,
    });
    await loginEmpresa(email, PASSWORD_NUEVA).expect(200);
    await loginEmpresa(email, 'otra-contraseña-distinta').expect(401);
  });

  it('un enlace caducado se rechaza con 410 y no cambia nada', async () => {
    const { id, email } = await personaNueva();
    const sesion = await abrirSesion(ds, id, ferreteriaId);
    await pedir(email).expect(200);
    const token = tokenDe(email);
    await ds.query(
      `UPDATE tokens_recuperacion SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [id],
    );

    const res = await restablecer(token).expect(410);
    expect(res.body).toMatchObject({ motivo: 'caducada' });
    expect((await tokensDe(id))[0].consumida).toBe(false);
    await loginEmpresa(email, PASSWORD_VIEJA).expect(200);
    const { n } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM sesiones WHERE user_id = $1`,
      [id],
    );
    expect(n).toBeGreaterThanOrEqual(1);
    expect(sesion).toBeDefined();
    const { n: rastro } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM bitacora WHERE entidad_id = $1`,
      [id],
    );
    expect(rastro).toBe(0);
  });

  it('un enlace desconocido es 404', async () => {
    const res = await restablecer('z'.repeat(43)).expect(404);
    expect(res.body).toMatchObject({ motivo: 'desconocida' });
  });

  it('una contraseña corta es 400 y deja el enlace vigente', async () => {
    const { id, email } = await personaNueva();
    await pedir(email).expect(200);
    const token = tokenDe(email);
    const res = await restablecer(token, 'corta').expect(400);
    expect(JSON.stringify(res.body)).toContain('12');
    expect((await tokensDe(id))[0].consumida).toBe(false);
    await restablecer(token).expect(200);
  });

  it('una cuenta desactivada tras pedir el enlace es 403 y no cambia nada', async () => {
    const { id, email } = await personaNueva();
    await pedir(email).expect(200);
    const token = tokenDe(email);
    await ds.query(`UPDATE users SET activo = false WHERE id = $1`, [id]);
    await restablecer(token).expect(403);
    expect((await tokensDe(id))[0].consumida).toBe(false);
  });

  it('aplica el límite de intentos fallidos', async () => {
    for (let i = 0; i < 10; i++) {
      await restablecer('z'.repeat(43)).expect(404);
    }
    await restablecer('z'.repeat(43)).expect(429);
  });
});

describe('recuperación del dueño de plataforma', () => {
  it('pide, restablece, borra sus sesiones y deja rastro en bitacora_plataforma', async () => {
    const login = await loginDueno(PASSWORD_VIEJA).expect(200);
    expect(setCookieDe(login)).toBeDefined();
    const { n: antes } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM sesiones WHERE plataforma_usuario_id = $1`,
      [duenoId],
    );
    expect(antes).toBeGreaterThanOrEqual(1);

    const a = await pedir(CORREO_DUENO).expect(200);
    const b = await pedir(`nadie@${DOMINIO}`).expect(200);
    expect(a.body).toEqual(b.body);
    const token = tokenDe(CORREO_DUENO);

    const res = await restablecer(token).expect(200);
    expect(setCookieDe(res)).toBeUndefined();

    const { n } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM sesiones WHERE plataforma_usuario_id = $1`,
      [duenoId],
    );
    expect(n).toBe(0);
    const rastro = await filas<{ accion: string; detalle: unknown }>(
      ds,
      `SELECT accion, detalle FROM bitacora_plataforma
        WHERE plataforma_usuario_id = $1 AND accion = 'restablecer_contrasena'`,
      [duenoId],
    );
    expect(rastro).toHaveLength(1);
    expect(JSON.stringify(rastro)).not.toContain(token);
    expect(JSON.stringify(rastro)).not.toContain(PASSWORD_NUEVA);

    await loginDueno(PASSWORD_VIEJA).expect(401);
    await loginDueno(PASSWORD_NUEVA).expect(200);
    // El enlace ya se usó.
    await restablecer(token).expect(410);
  });

  it('un nuevo enlace reemplaza al anterior', async () => {
    await pedir(CORREO_DUENO).expect(200);
    const viejo = tokenDe(CORREO_DUENO);
    await pedir(CORREO_DUENO).expect(200);
    await restablecer(viejo).expect(410);
    await restablecer(tokenDe(CORREO_DUENO)).expect(200);
  });
});
