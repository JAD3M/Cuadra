import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import type { Rol } from '../common/entities/tipos';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import { abrirSesion } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { UsuariosModule } from './usuarios.module';

const PREFIJO_LIMITE = 'cuadra_test_usuarios_roles';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 2.6 (FR-45, FR-46): una persona administradora cambia o quita los
 * roles de alguien de su equipo. Postgres y Redis reales; la app corre como
 * cuadra_app. Cada prueba arma su propia empresa para que "el único admin"
 * sea verdad y las pruebas no se pisen entre sí.
 */

const DOMINIO = 'usuarios-roles.test';
const MENSAJE_ULTIMO_ADMIN =
  'No se puede quitar ni degradar al único administrador. Asigna el rol de administrador a otra persona primero.';

interface Escenario {
  empresaId: string;
  adminId: string;
  cookieAdmin: string;
}

let app: INestApplication<App>;
let ds: DataSource;
let contador = 0;
const inicio = new Date();
const empresasCreadas: string[] = [];

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();

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
      UsuariosModule,
    ],
  }).compile();
  app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    await ds.query(
      `DELETE FROM sesiones WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(`DELETE FROM bitacora WHERE company_id = ANY($1)`, [
      empresasCreadas,
    ]);
    await ds.query(
      `DELETE FROM user_company_roles WHERE company_id = ANY($1)`,
      [empresasCreadas],
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    await ds.query(`DELETE FROM companies WHERE id = ANY($1)`, [
      empresasCreadas,
    ]);
    await ds.destroy();
  }
});

beforeEach(async () => {
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
});

afterEach(() => jest.restoreAllMocks());

const http = () => request(app.getHttpServer());

async function crearEmpresa(): Promise<string> {
  contador += 1;
  const rfc = `RLS${String(contador).padStart(6, '0')}AB1`;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO companies (rfc, razon_social) VALUES ($1, $2) RETURNING id`,
    [rfc, `Empresa Roles ${contador} SA`],
  );
  empresasCreadas.push(id);
  return id;
}

async function crearUsuario(
  prefijo: string,
  roles: Array<{ companyId: string; rol: Rol }>,
): Promise<{ id: string; email: string }> {
  contador += 1;
  const email = `${prefijo}${contador}@${DOMINIO}`;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO users (email, nombre, password_hash)
     VALUES ($1, $2, 'no-sirve') RETURNING id`,
    [email, `Persona ${prefijo} ${contador}`],
  );
  for (const r of roles) {
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol) VALUES ($1, $2, $3)`,
      [id, r.companyId, r.rol],
    );
  }
  return { id, email };
}

/** Una empresa con su único admin y la cookie de este. */
async function escenario(): Promise<Escenario> {
  const empresaId = await crearEmpresa();
  const admin = await crearUsuario('admin', [
    { companyId: empresaId, rol: 'admin' },
  ]);
  return {
    empresaId,
    adminId: admin.id,
    cookieAdmin: await abrirSesion(ds, admin.id, empresaId),
  };
}

const rolesDe = async (userId: string, companyId: string): Promise<Rol[]> =>
  (
    await filas<{ rol: Rol }>(
      ds,
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2
        ORDER BY rol`,
      [userId, companyId],
    )
  ).map((f) => f.rol);

const bitacoraDe = (companyId: string, accion: string) =>
  filas<{
    user_id: string;
    entidad: string;
    entidad_id: string;
    created_at: Date;
    datos: Record<string, unknown>;
  }>(
    ds,
    `SELECT user_id, entidad, entidad_id, created_at, datos FROM bitacora
      WHERE company_id = $1 AND accion = $2 ORDER BY created_at`,
    [companyId, accion],
  );

const cambiar = (
  id: string,
  cuerpo: Record<string, unknown>,
  cookie: string,
): request.Test =>
  http().patch(`/usuarios/${id}/roles`).set('Cookie', cookie).send(cuerpo);

const quitar = (id: string, cookie: string): request.Test =>
  http().delete(`/usuarios/${id}/roles`).set('Cookie', cookie);

describe('PATCH /usuarios/:id/roles', () => {
  it('reemplaza el conjunto de roles y lo deja en la bitácora con quién, cuándo y qué roles', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
      { companyId: e.empresaId, rol: 'revisor' },
    ]);

    const res = await cambiar(
      luis.id,
      { roles: ['revisor', 'auditor'] },
      e.cookieAdmin,
    ).expect(200);

    expect(res.body).toEqual({
      id: luis.id,
      email: luis.email,
      roles: ['revisor', 'auditor'],
    });
    expect(await rolesDe(luis.id, e.empresaId)).toEqual(['auditor', 'revisor']);
    const [fila] = await bitacoraDe(e.empresaId, 'cambiar_rol');
    expect(fila.user_id).toBe(e.adminId);
    expect(fila.entidad).toBe('companies');
    expect(fila.entidad_id).toBe(e.empresaId);
    expect(fila.created_at.getTime()).toBeGreaterThanOrEqual(inicio.getTime());
    expect(fila.datos).toEqual({
      usuarioId: luis.id,
      email: luis.email,
      antes: ['contador', 'revisor'],
      despues: ['revisor', 'auditor'],
    });
  });

  it('la siguiente petición de esa persona ya refleja los roles nuevos', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
    ]);
    const cookieLuis = await abrirSesion(ds, luis.id, e.empresaId);
    await http().get('/usuarios').set('Cookie', cookieLuis).expect(403);

    await cambiar(luis.id, { roles: ['admin'] }, e.cookieAdmin).expect(200);
    await http().get('/usuarios').set('Cookie', cookieLuis).expect(200);

    await cambiar(luis.id, { roles: ['contador'] }, e.cookieAdmin).expect(200);
    await http().get('/usuarios').set('Cookie', cookieLuis).expect(403);
  });

  it('si el conjunto resultante es el mismo responde 200 sin escribir ni registrar', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
      { companyId: e.empresaId, rol: 'revisor' },
    ]);

    const res = await cambiar(
      luis.id,
      { roles: ['revisor', 'contador'] },
      e.cookieAdmin,
    ).expect(200);

    expect(res.body).toEqual({
      id: luis.id,
      email: luis.email,
      roles: ['contador', 'revisor'],
    });
    expect(await bitacoraDe(e.empresaId, 'cambiar_rol')).toHaveLength(0);
  });

  it('conserva los roles que tiene en otra empresa', async () => {
    const e = await escenario();
    const otra = await crearEmpresa();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
      { companyId: otra, rol: 'admin' },
      { companyId: otra, rol: 'revisor' },
    ]);

    await cambiar(luis.id, { roles: ['auditor'] }, e.cookieAdmin).expect(200);

    expect(await rolesDe(luis.id, e.empresaId)).toEqual(['auditor']);
    expect(await rolesDe(luis.id, otra)).toEqual(['admin', 'revisor']);
  });

  it.each(['contador', 'revisor', 'auditor'] as const)(
    '%s recibe 403 y no cambia nada',
    async (rol) => {
      const e = await escenario();
      const luis = await crearUsuario('luis', [
        { companyId: e.empresaId, rol: 'contador' },
      ]);
      const quien = await crearUsuario(rol, [{ companyId: e.empresaId, rol }]);
      const cookie = await abrirSesion(ds, quien.id, e.empresaId);

      await cambiar(luis.id, { roles: ['admin'] }, cookie).expect(403);

      expect(await rolesDe(luis.id, e.empresaId)).toEqual(['contador']);
      expect(await bitacoraDe(e.empresaId, 'cambiar_rol')).toHaveLength(0);
    },
  );

  it('sin sesión responde 401', async () => {
    const e = await escenario();
    await http()
      .patch(`/usuarios/${e.adminId}/roles`)
      .send({ roles: ['admin'] })
      .expect(401);
  });

  it('una persona de otra empresa o inexistente: 404 y no toca nada', async () => {
    const e = await escenario();
    const otra = await escenario();
    const ajeno = await crearUsuario('ajeno', [
      { companyId: otra.empresaId, rol: 'contador' },
    ]);

    await cambiar(ajeno.id, { roles: ['admin'] }, e.cookieAdmin).expect(404);
    await cambiar(
      '0190a000-0000-7000-8000-000000000000',
      { roles: ['admin'] },
      e.cookieAdmin,
    ).expect(404);

    expect(await rolesDe(ajeno.id, otra.empresaId)).toEqual(['contador']);
    expect(await rolesDe(ajeno.id, e.empresaId)).toEqual([]);
    expect(await bitacoraDe(e.empresaId, 'cambiar_rol')).toHaveLength(0);
  });

  it('el id que no es uuid responde 400', async () => {
    const e = await escenario();
    await cambiar('no-es-uuid', { roles: ['admin'] }, e.cookieAdmin).expect(
      400,
    );
  });

  describe('validación del cuerpo', () => {
    it.each([
      ['sin roles', []],
      ['más de cuatro roles', ['admin', 'contador', 'revisor', 'auditor', 'x']],
      ['un rol que no existe', ['contador', 'jefe']],
      ['roles que no son un arreglo', 'admin'],
    ])('%s: 400', async (_nombre, roles) => {
      const e = await escenario();
      const luis = await crearUsuario('luis', [
        { companyId: e.empresaId, rol: 'contador' },
      ]);

      await cambiar(luis.id, { roles }, e.cookieAdmin).expect(400);

      expect(await rolesDe(luis.id, e.empresaId)).toEqual(['contador']);
    });

    it('los repetidos se descartan', async () => {
      const e = await escenario();
      const luis = await crearUsuario('luis', [
        { companyId: e.empresaId, rol: 'contador' },
      ]);

      const res = await cambiar(
        luis.id,
        { roles: ['revisor', 'revisor', 'auditor', 'revisor'] },
        e.cookieAdmin,
      ).expect(200);

      expect((res.body as { roles: string[] }).roles).toEqual([
        'revisor',
        'auditor',
      ]);
      expect(await rolesDe(luis.id, e.empresaId)).toEqual([
        'auditor',
        'revisor',
      ]);
    });
  });

  describe('último admin (FR-46)', () => {
    it('no se puede degradar al único admin: 409 con mensaje claro y nada cambia', async () => {
      const e = await escenario();
      const otro = await crearUsuario('luis', [
        { companyId: e.empresaId, rol: 'contador' },
      ]);

      // El admin se degrada a sí mismo: la regla vale también para él.
      const res = await cambiar(
        e.adminId,
        { roles: ['contador'] },
        e.cookieAdmin,
      ).expect(409);

      expect((res.body as { message: string }).message).toBe(
        MENSAJE_ULTIMO_ADMIN,
      );
      expect(await rolesDe(e.adminId, e.empresaId)).toEqual(['admin']);
      expect(await rolesDe(otro.id, e.empresaId)).toEqual(['contador']);
      expect(await bitacoraDe(e.empresaId, 'cambiar_rol')).toHaveLength(0);
    });

    it('quitar admin en un conjunto que lo conserva no se rechaza', async () => {
      const e = await escenario();

      await cambiar(
        e.adminId,
        { roles: ['admin', 'contador'] },
        e.cookieAdmin,
      ).expect(200);

      expect(await rolesDe(e.adminId, e.empresaId)).toEqual([
        'admin',
        'contador',
      ]);
    });

    it('se permite si existe otro admin', async () => {
      const e = await escenario();
      await crearUsuario('segundo', [{ companyId: e.empresaId, rol: 'admin' }]);

      await cambiar(e.adminId, { roles: ['contador'] }, e.cookieAdmin).expect(
        200,
      );

      expect(await rolesDe(e.adminId, e.empresaId)).toEqual(['contador']);
    });

    it('un admin de otra empresa no cuenta como "otro admin"', async () => {
      const e = await escenario();
      const otra = await crearEmpresa();
      await crearUsuario('foraneo', [{ companyId: otra, rol: 'admin' }]);

      await cambiar(e.adminId, { roles: ['revisor'] }, e.cookieAdmin).expect(
        409,
      );
    });
  });
});

describe('DELETE /usuarios/:id/roles', () => {
  it('quita todos sus roles en la empresa y lo deja en la bitácora con quién, cuándo y qué roles', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
      { companyId: e.empresaId, rol: 'revisor' },
    ]);

    const res = await quitar(luis.id, e.cookieAdmin).expect(200);

    expect(res.body).toEqual({ id: luis.id, email: luis.email, roles: [] });
    expect(await rolesDe(luis.id, e.empresaId)).toEqual([]);
    const [fila] = await bitacoraDe(e.empresaId, 'quitar_rol');
    expect(fila.user_id).toBe(e.adminId);
    expect(fila.entidad).toBe('companies');
    expect(fila.entidad_id).toBe(e.empresaId);
    expect(fila.created_at.getTime()).toBeGreaterThanOrEqual(inicio.getTime());
    expect(fila.datos).toEqual({
      usuarioId: luis.id,
      email: luis.email,
      roles: ['contador', 'revisor'],
    });
  });

  it('pierde la empresa de inmediato: su sesión elegida en ella deja de servir', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'admin' },
    ]);
    const cookieLuis = await abrirSesion(ds, luis.id, e.empresaId);
    await http().get('/usuarios').set('Cookie', cookieLuis).expect(200);

    await quitar(luis.id, e.cookieAdmin).expect(200);

    await http().get('/usuarios').set('Cookie', cookieLuis).expect(401);
  });

  it('conserva sus roles y sus sesiones en otras empresas', async () => {
    const e = await escenario();
    const otra = await crearEmpresa();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
      { companyId: otra, rol: 'admin' },
    ]);
    const cookieAqui = await abrirSesion(ds, luis.id, e.empresaId);
    const cookieOtra = await abrirSesion(ds, luis.id, otra);
    await abrirSesion(ds, luis.id, null);

    await quitar(luis.id, e.cookieAdmin).expect(200);

    expect(await rolesDe(luis.id, otra)).toEqual(['admin']);
    const quedan = await filas<{ company_id: string | null }>(
      ds,
      `SELECT company_id FROM sesiones WHERE user_id = $1`,
      [luis.id],
    );
    expect(quedan.map((s) => s.company_id).sort()).toEqual([otra, null].sort());
    await http().get('/usuarios').set('Cookie', cookieAqui).expect(401);
    await http().get('/usuarios').set('Cookie', cookieOtra).expect(200);
  });

  it('no cierra las sesiones de otras personas de la empresa', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
    ]);

    await quitar(luis.id, e.cookieAdmin).expect(200);

    await http().get('/usuarios').set('Cookie', e.cookieAdmin).expect(200);
  });

  it.each(['contador', 'revisor', 'auditor'] as const)(
    '%s recibe 403 y no cambia nada',
    async (rol) => {
      const e = await escenario();
      const luis = await crearUsuario('luis', [
        { companyId: e.empresaId, rol: 'contador' },
      ]);
      const quien = await crearUsuario(rol, [{ companyId: e.empresaId, rol }]);
      const cookie = await abrirSesion(ds, quien.id, e.empresaId);

      await quitar(luis.id, cookie).expect(403);

      expect(await rolesDe(luis.id, e.empresaId)).toEqual(['contador']);
      expect(await bitacoraDe(e.empresaId, 'quitar_rol')).toHaveLength(0);
    },
  );

  it('una persona de otra empresa o sin roles aquí: 404 y no toca nada', async () => {
    const e = await escenario();
    const otra = await escenario();
    const ajeno = await crearUsuario('ajeno', [
      { companyId: otra.empresaId, rol: 'contador' },
    ]);
    const cookieAjeno = await abrirSesion(ds, ajeno.id, otra.empresaId);

    await quitar(ajeno.id, e.cookieAdmin).expect(404);
    await quitar('0190a000-0000-7000-8000-000000000000', e.cookieAdmin).expect(
      404,
    );

    expect(await rolesDe(ajeno.id, otra.empresaId)).toEqual(['contador']);
    await http().get('/usuarios').set('Cookie', cookieAjeno).expect(403);
    expect(await bitacoraDe(e.empresaId, 'quitar_rol')).toHaveLength(0);
  });

  it('quitar dos veces: la segunda es 404 y no duplica la bitácora', async () => {
    const e = await escenario();
    const luis = await crearUsuario('luis', [
      { companyId: e.empresaId, rol: 'contador' },
    ]);

    await quitar(luis.id, e.cookieAdmin).expect(200);
    await quitar(luis.id, e.cookieAdmin).expect(404);

    expect(await bitacoraDe(e.empresaId, 'quitar_rol')).toHaveLength(1);
  });

  describe('último admin (FR-46)', () => {
    it('no se puede quitar al único admin, ni siquiera a sí mismo: 409 y nada cambia', async () => {
      const e = await escenario();

      const res = await quitar(e.adminId, e.cookieAdmin).expect(409);

      expect((res.body as { message: string }).message).toBe(
        MENSAJE_ULTIMO_ADMIN,
      );
      expect(await rolesDe(e.adminId, e.empresaId)).toEqual(['admin']);
      expect(await bitacoraDe(e.empresaId, 'quitar_rol')).toHaveLength(0);
      await http().get('/usuarios').set('Cookie', e.cookieAdmin).expect(200);
    });

    it('se puede quitar a un admin si existe otro', async () => {
      const e = await escenario();
      const segundo = await crearUsuario('segundo', [
        { companyId: e.empresaId, rol: 'admin' },
      ]);

      await quitar(segundo.id, e.cookieAdmin).expect(200);

      expect(await rolesDe(segundo.id, e.empresaId)).toEqual([]);
      expect(await rolesDe(e.adminId, e.empresaId)).toEqual(['admin']);
    });

    it('dos admins que se quitan a la vez: solo uno lo logra', async () => {
      const e = await escenario();
      const segundo = await crearUsuario('segundo', [
        { companyId: e.empresaId, rol: 'admin' },
      ]);
      const cookieSegundo = await abrirSesion(ds, segundo.id, e.empresaId);

      const [a, b] = await Promise.all([
        quitar(segundo.id, e.cookieAdmin),
        quitar(e.adminId, cookieSegundo),
      ]);

      // El perdedor recibe 409 si ya estaba autenticado cuando el otro
      // confirmó, o 401 si su sesión ya se había cerrado: nunca 200.
      expect([a.status, b.status].filter((c) => c === 200)).toHaveLength(1);
      expect(
        [a.status, b.status].filter((c) => c === 409 || c === 401),
      ).toHaveLength(1);
      const { n } = await una<{ n: number }>(
        ds,
        `SELECT count(*)::int AS n FROM user_company_roles
          WHERE company_id = $1 AND rol = 'admin'`,
        [e.empresaId],
      );
      expect(n).toBe(1);
    });
  });
});
