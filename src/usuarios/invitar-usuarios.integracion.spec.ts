import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { huellaDeToken } from '../auth/sesiones.service';
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
import { abrirSesion } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { UsuariosModule } from './usuarios.module';

const PREFIJO_LIMITE = 'cuadra_test_usuarios_invitar';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 2.3 (FR-41, FR-50): una persona administradora invita a su gente
 * con uno o más roles. Postgres y Redis reales; la app corre como cuadra_app
 * y el correo es el adaptador simulado.
 */

const ANA = 'ana.reyes@fdb.mx'; // admin de la ferretería
const LUIS = 'luis.mendoza@fdb.mx'; // contador de la ferretería
const FERRETERIA = 'FDB190215QK4';
const DOMINIO = 'usuarios-invitar.test';
const PASSWORD_NUEVA = 'contraseña-nueva-segura';

let app: INestApplication<App>;
let ds: DataSource;
let correo: CorreoSimulado;
let empresaId: string;
let anaId: string;
let luisId: string;
let cookieAna: string;
let cookieLuis: string;
let contador = 0;
const inicio = new Date();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  const idDe = async (email: string) =>
    (
      await una<{ id: string }>(ds, 'SELECT id FROM users WHERE email = $1', [
        email,
      ])
    ).id;
  anaId = await idDe(ANA);
  luisId = await idDe(LUIS);
  empresaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM companies WHERE rfc = $1', [
      FERRETERIA,
    ])
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
      UsuariosModule,
    ],
  }).compile();
  app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
  correo = app.get(ProveedorCorreo, { strict: false });
  cookieAna = await abrirSesion(ds, anaId, empresaId);
  cookieLuis = await abrirSesion(ds, luisId, empresaId);
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    await ds.query(`DELETE FROM sesiones WHERE user_id = ANY($1)`, [
      [anaId, luisId],
    ]);
    await ds.query(
      `DELETE FROM sesiones WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(
      `DELETE FROM user_company_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    // También las de cuentas ya sembradas (LUIS): ninguna invitación de
    // empresa debe quedar, o la reversibilidad de la migración no cabe.
    await ds.query(
      `DELETE FROM invitaciones WHERE invitada_por_user_id = ANY($1)`,
      [[anaId, luisId]],
    );
    await ds.query(
      `DELETE FROM bitacora WHERE company_id = $1 AND created_at >= $2
         AND accion IN ('invitar', 'acceso_denegado')`,
      [empresaId, inicio],
    );
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

function correoNuevo(): string {
  contador += 1;
  return `persona${contador}@${DOMINIO}`;
}

function invitar(
  cuerpo: Record<string, unknown>,
  cookie: string = cookieAna,
): request.Test {
  return http()
    .post('/usuarios/invitaciones')
    .set('Cookie', cookie)
    .send(cuerpo);
}

function tokenDe(para: string): string {
  const m = /\/invitacion\/([A-Za-z0-9_-]+)/.exec(
    correo.ultimoPara(para)?.texto ?? '',
  );
  if (!m) throw new Error(`No hubo correo con enlace para ${para}`);
  return m[1];
}

describe('POST /usuarios/invitaciones', () => {
  it('crea la invitación con los roles elegidos, 7 días, huella del token y el invitador', async () => {
    const email = correoNuevo();
    const res = await invitar({
      email,
      roles: ['contador', 'revisor'],
    }).expect(201);

    expect(res.body).toEqual({ email, roles: ['contador', 'revisor'] });
    const token = tokenDe(email);
    expect(correo.ultimoPara(email)?.texto).toContain(
      `${process.env.ORIGEN_AUTORIZADO}/invitacion/${token}`,
    );
    const fila = await una<Record<string, unknown>>(
      ds,
      `SELECT token_hash, roles, company_id,
              round(extract(epoch FROM (expires_at - created_at)) / 86400)::int AS dias,
              invitada_por_user_id, invitada_por_plataforma_usuario_id
         FROM invitaciones WHERE email = $1`,
      [email],
    );
    expect(fila).toEqual({
      token_hash: huellaDeToken(token),
      roles: ['contador', 'revisor'],
      company_id: empresaId,
      dias: 7,
      invitada_por_user_id: anaId,
      invitada_por_plataforma_usuario_id: null,
    });
  });

  it('deja invitar en la bitácora de la empresa con quién invitó, el correo y los roles', async () => {
    const email = correoNuevo();
    await invitar({ email, roles: ['auditor', 'admin'] }).expect(201);

    const fila = await una<{
      user_id: string;
      entidad: string;
      entidad_id: string;
      datos: { email: string; roles: string[]; invitacionId: string };
    }>(
      ds,
      `SELECT user_id, entidad, entidad_id, datos FROM bitacora
        WHERE company_id = $1 AND accion = 'invitar' AND datos->>'email' = $2`,
      [empresaId, email],
    );
    expect(fila.user_id).toBe(anaId);
    expect(fila.entidad).toBe('companies');
    expect(fila.entidad_id).toBe(empresaId);
    expect(fila.datos.roles).toEqual(['auditor', 'admin']);
    expect(fila.datos.invitacionId).toEqual(expect.any(String));
    // El token en claro no queda en la bitácora.
    expect(JSON.stringify(fila.datos)).not.toContain(tokenDe(email));
  });

  it('la respuesta es idéntica exista o no la cuenta y normaliza el correo', async () => {
    const existente = await invitar({
      email: `  ${LUIS.toUpperCase()} `,
      roles: ['revisor'],
    });
    const inexistente = await invitar({
      email: `  ${correoNuevo().toUpperCase()} `,
      roles: ['revisor'],
    });

    expect(existente.status).toBe(201);
    expect(inexistente.status).toBe(existente.status);
    expect(Object.keys(inexistente.body as object)).toEqual(
      Object.keys(existente.body as object),
    );
    expect(existente.body).toEqual({ email: LUIS, roles: ['revisor'] });
    expect(correo.ultimoPara(LUIS)).toBeDefined();
    const fila = await una<{ email: string }>(
      ds,
      `SELECT email FROM invitaciones WHERE email LIKE '%@${DOMINIO}' ORDER BY created_at DESC LIMIT 1`,
    );
    expect(fila.email).toBe(fila.email.toLowerCase());
  });

  it('deduplica los roles', async () => {
    const email = correoNuevo();
    const res = await invitar({
      email,
      roles: ['contador', 'contador', 'revisor', 'contador'],
    }).expect(201);
    expect(res.body).toEqual({ email, roles: ['contador', 'revisor'] });
    const fila = await una<{ roles: string[] }>(
      ds,
      `SELECT roles FROM invitaciones WHERE email = $1`,
      [email],
    );
    expect(fila.roles).toEqual(['contador', 'revisor']);
  });

  it.each([
    ['sin roles', { roles: [] }],
    ['roles ausentes', {}],
    ['rol inventado', { roles: ['contador', 'inventado'] }],
    ['roles que no es lista', { roles: 'admin' }],
  ])('%s: 400 y no crea nada', async (_nombre, extra) => {
    const email = correoNuevo();
    await invitar({ email, ...extra }).expect(400);
    const filasInv = await filas(
      ds,
      `SELECT 1 FROM invitaciones WHERE email = $1`,
      [email],
    );
    expect(filasInv).toHaveLength(0);
    expect(correo.enviados).toHaveLength(0);
  });

  it('un correo inválido: 400', async () => {
    await invitar({ email: 'no-es-correo', roles: ['admin'] }).expect(400);
  });

  it('una invitación nueva al mismo correo invalida el enlace anterior', async () => {
    const email = correoNuevo();
    await invitar({ email, roles: ['revisor'] }).expect(201);
    const viejo = tokenDe(email);
    await invitar({ email, roles: ['contador'] }).expect(201);

    const estado = await http().get(`/auth/invitaciones/${viejo}`).expect(200);
    expect(estado.body).toMatchObject({
      estado: 'invalida',
      motivo: 'reemplazada',
    });
    const vivas = await filas<{ roles: string[] }>(
      ds,
      `SELECT roles FROM invitaciones
        WHERE company_id = $1 AND email = $2
          AND consumida_en IS NULL AND reemplazada_en IS NULL`,
      [empresaId, email],
    );
    expect(vivas).toEqual([{ roles: ['contador'] }]);
  });

  it('sin rol admin: 403, no crea nada y deja acceso denegado con rol y permiso', async () => {
    const email = correoNuevo();
    const res = await invitar({ email, roles: ['admin'] }, cookieLuis);

    expect(res.status).toBe(403);
    expect(correo.enviados).toHaveLength(0);
    const filasInv = await filas(
      ds,
      `SELECT 1 FROM invitaciones WHERE email = $1`,
      [email],
    );
    expect(filasInv).toHaveLength(0);
    const denegado = await una<{
      user_id: string;
      datos: Record<string, unknown>;
    }>(
      ds,
      `SELECT user_id, datos FROM bitacora
        WHERE company_id = $1 AND accion = 'acceso_denegado' AND created_at >= $2
          AND datos->>'ruta' = '/usuarios/invitaciones'`,
      [empresaId, inicio],
    );
    expect(denegado.user_id).toBe(luisId);
    expect(denegado.datos).toMatchObject({
      permiso: 'usuarios.gestionar',
      rolesDelUsuario: ['contador'],
      motivo: 'rol_insuficiente',
    });
  });

  it('sin sesión: 401', async () => {
    await http()
      .post('/usuarios/invitaciones')
      .send({ email: correoNuevo(), roles: ['admin'] })
      .expect(401);
  });

  it('si el correo falla: 503 con el mismo mensaje que plataforma y sin token en el log', async () => {
    jest.spyOn(correo, 'enviar').mockRejectedValueOnce(new Error('smtp caído'));
    const res = await invitar({
      email: correoNuevo(),
      roles: ['admin'],
    }).expect(503);
    expect(JSON.stringify(res.body)).toContain('No se pudo enviar el correo');
  });

  it('si la bitácora falla no queda invitación ni sale correo', async () => {
    await ds.query(`
      CREATE OR REPLACE FUNCTION fallar_bitacora_invitar() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'bitacora caida a proposito'; END $$ LANGUAGE plpgsql`);
    await ds.query(
      `CREATE TRIGGER tg_fallar_bitacora_invitar BEFORE INSERT ON bitacora
       FOR EACH ROW WHEN (NEW.accion = 'invitar')
       EXECUTE FUNCTION fallar_bitacora_invitar()`,
    );
    try {
      const email = correoNuevo();
      await invitar({ email, roles: ['admin'] }).expect(500);
      expect(correo.enviados).toHaveLength(0);
      const filasInv = await filas(
        ds,
        `SELECT 1 FROM invitaciones WHERE email = $1`,
        [email],
      );
      expect(filasInv).toHaveLength(0);
    } finally {
      await ds.query(`DROP TRIGGER tg_fallar_bitacora_invitar ON bitacora`);
      await ds.query('DROP FUNCTION fallar_bitacora_invitar()');
    }
  });

  it('el enlace se acepta y da todos los roles elegidos', async () => {
    const email = correoNuevo();
    await invitar({ email, roles: ['contador', 'auditor'] }).expect(201);

    await http()
      .post(`/auth/invitaciones/${tokenDe(email)}/aceptar`)
      .send({ password: PASSWORD_NUEVA, nombre: 'Equipo Nuevo' })
      .expect(200);

    const roles = await filas<{ rol: string }>(
      ds,
      `SELECT r.rol FROM user_company_roles r JOIN users u ON u.id = r.user_id
        WHERE u.email = $1 AND r.company_id = $2 ORDER BY r.rol`,
      [email, empresaId],
    );
    expect(roles).toEqual([{ rol: 'auditor' }, { rol: 'contador' }]);
  });

  it('el límite cuenta también los envíos exitosos', async () => {
    for (let i = 0; i < 20; i++) {
      await invitar({ email: correoNuevo(), roles: ['revisor'] }).expect(201);
    }
    const res = await invitar({
      email: correoNuevo(),
      roles: ['revisor'],
    }).expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
