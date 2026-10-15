import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password';
import { huellaDeToken, nuevoToken } from '../auth/sesiones.service';
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
import {
  abrirSesion,
  cookieDe,
  setCookieDe,
} from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';

const PREFIJO_LIMITE = 'cuadra_test_invitaciones';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 1.5 (FR-40, AD-14): invitar al primer administrador y aceptar el
 * enlace. Postgres y Redis reales; la app corre como cuadra_app y el correo
 * es el adaptador simulado.
 */

const CORREO_DUENO = 'dueno-invita@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const ANA = 'ana.reyes@fdb.mx';
const FERRETERIA = 'FDB190215QK4';
const RFC_EMPRESA = 'INV240101AB1';
const DOMINIO = 'invitaciones.test';
const PASSWORD_NUEVA = 'contraseña-nueva-segura';

let app: INestApplication<App>;
let ds: DataSource;
let correo: CorreoSimulado;
let empresaId: string;
let anaId: string;
let ferreteriaId: string;
let duenoId: string;
let contador = 0;
let cookieDueno: string;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  const hash = await new PasswordHasher().hashear(PASSWORD_DUENO);
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
  anaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM users WHERE email = $1', [
      ANA,
    ])
  ).id;
  ferreteriaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM companies WHERE rfc = $1', [
      FERRETERIA,
    ])
  ).id;
  empresaId = (
    await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ($1, 'Invitadora SA de CV')
       ON CONFLICT (rfc) DO UPDATE SET razon_social = 'Invitadora SA de CV'
       RETURNING id`,
      [RFC_EMPRESA],
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
  cookieDueno = await loginDueno();
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    // Las bitácoras son de solo agregar para cuadra_app; el dueño limpia.
    await ds.query(
      `DELETE FROM sesiones WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(
      `DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL`,
    );
    await ds.query(
      `DELETE FROM user_company_roles WHERE company_id = $1 OR user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
      [empresaId],
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    await ds.query(`DELETE FROM invitaciones WHERE company_id = $1`, [
      empresaId,
    ]);
    await ds.query(`DELETE FROM bitacora WHERE company_id = $1`, [empresaId]);
    await ds.query(`DELETE FROM bitacora_plataforma`);
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
  // Los fallos de envío y de bitácora se registran en error: sin ruido.
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
});

afterEach(() => jest.restoreAllMocks());

const http = () => request(app.getHttpServer());

function correoNuevo(): string {
  contador += 1;
  return `persona${contador}@${DOMINIO}`;
}

async function loginDueno(): Promise<string> {
  const res = await http()
    .post('/plataforma/auth/login')
    .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
    .expect(200);
  return cookieDe(res);
}

function invitar(
  email: string,
  cookie: string = cookieDueno,
  id: string = empresaId,
): request.Test {
  return http()
    .post(`/plataforma/empresas/${id}/invitaciones`)
    .set('Cookie', cookie)
    .send({ email });
}

/** Token del último correo enviado a `para`. */
function tokenDe(para: string): string {
  const mensaje = correo.ultimoPara(para);
  const m = /\/invitacion\/([A-Za-z0-9_-]+)/.exec(mensaje?.texto ?? '');
  if (!m) throw new Error(`No hubo correo con enlace para ${para}`);
  return m[1];
}

const consultar = (token: string) => http().get(`/auth/invitaciones/${token}`);
const aceptar = (token: string, cuerpo: Record<string, unknown> = {}) =>
  http().post(`/auth/invitaciones/${token}/aceptar`).send(cuerpo);

describe('POST /plataforma/empresas/:id/invitaciones', () => {
  it('responde 201 y envía el correo con el enlace de ORIGEN_AUTORIZADO', async () => {
    const email = correoNuevo();
    const res = await invitar(email).expect(201);

    expect(res.body).toEqual({ email });
    const mensaje = correo.ultimoPara(email);
    expect(mensaje?.asunto).toMatch(/Invitadora SA de CV/);
    const token = tokenDe(email);
    expect(token).toHaveLength(43);
    expect(mensaje?.texto).toContain(
      `${process.env.ORIGEN_AUTORIZADO}/invitacion/${token}`,
    );
  });

  it('la respuesta es idéntica exista o no la cuenta, y normaliza el correo', async () => {
    const existente = await invitar(ANA).expect(201);
    const inexistente = await invitar(`  ${correoNuevo().toUpperCase()} `);

    expect(inexistente.status).toBe(existente.status);
    expect(Object.keys(inexistente.body as object)).toEqual(
      Object.keys(existente.body as object),
    );
    expect(existente.body).toEqual({ email: ANA });
    // También se envió correo a la cuenta existente: no se ramifica.
    expect(correo.ultimoPara(ANA)).toBeDefined();
    const fila = await una<{ email: string }>(
      ds,
      `SELECT email FROM invitaciones WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [empresaId],
    );
    expect(fila.email).toBe(fila.email.toLowerCase());
  });

  it('guarda solo la huella del token, con 7 días de vigencia y rol admin', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    const token = tokenDe(email);

    const fila = await una<{
      token_hash: string;
      roles: string[];
      dias: number;
      invitada_por: string;
    }>(
      ds,
      `SELECT token_hash, roles,
              round(extract(epoch FROM (expires_at - created_at)) / 86400)::int AS dias,
              invitada_por_plataforma_usuario_id AS invitada_por
         FROM invitaciones WHERE email = $1`,
      [email],
    );
    expect(fila).toEqual({
      token_hash: huellaDeToken(token),
      roles: ['admin'],
      dias: 7,
      invitada_por: duenoId,
    });
    // El token en claro no está en ninguna parte de la base.
    const rastro = await filas<{ n: number }>(
      ds,
      `SELECT 1 AS n FROM invitaciones WHERE token_hash = $1
       UNION ALL SELECT 1 FROM bitacora WHERE datos::text LIKE $2
       UNION ALL SELECT 1 FROM bitacora_plataforma WHERE detalle::text LIKE $2`,
      [token, `%${token}%`],
    );
    expect(rastro).toHaveLength(0);
  });

  it('deja invitar en las dos bitácoras', async () => {
    const email = correoNuevo();
    const desde = new Date();
    await invitar(email).expect(201);

    const empresa = await una<{
      user_id: string | null;
      entidad: string;
      entidad_id: string;
      datos: { plataformaUsuarioId: string; email: string };
    }>(
      ds,
      `SELECT user_id, entidad, entidad_id, datos FROM bitacora
        WHERE company_id = $1 AND accion = 'invitar' AND created_at >= $2
          AND datos->>'email' = $3`,
      [empresaId, desde, email],
    );
    expect(empresa.user_id).toBeNull();
    expect(empresa.entidad).toBe('companies');
    expect(empresa.entidad_id).toBe(empresaId);
    expect(empresa.datos.plataformaUsuarioId).toBe(duenoId);

    const plataforma = await una<{
      plataforma_usuario_id: string;
      company_id: string;
      detalle: { email: string };
    }>(
      ds,
      `SELECT plataforma_usuario_id, company_id, detalle FROM bitacora_plataforma
        WHERE accion = 'invitar' AND created_at >= $1 AND detalle->>'email' = $2`,
      [desde, email],
    );
    expect(plataforma.plataforma_usuario_id).toBe(duenoId);
    expect(plataforma.company_id).toBe(empresaId);
  });

  it('si la bitácora de plataforma falla no queda invitación ni sale correo', async () => {
    await ds.query(`
      CREATE OR REPLACE FUNCTION fallar_bitacora_prueba() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'bitacora caida a proposito'; END $$ LANGUAGE plpgsql`);
    await ds.query(
      `CREATE TRIGGER tg_fallar_bitacora_prueba BEFORE INSERT ON bitacora_plataforma
       FOR EACH ROW WHEN (NEW.accion = 'invitar')
       EXECUTE FUNCTION fallar_bitacora_prueba()`,
    );
    try {
      const email = correoNuevo();
      await invitar(email).expect(500);
      expect(correo.enviados).toHaveLength(0);
      const filasInv = await filas(
        ds,
        `SELECT 1 FROM invitaciones WHERE email = $1`,
        [email],
      );
      expect(filasInv).toHaveLength(0);
    } finally {
      await ds.query(
        `DROP TRIGGER tg_fallar_bitacora_prueba ON bitacora_plataforma`,
      );
      await ds.query('DROP FUNCTION fallar_bitacora_prueba()');
    }
  });

  it('una invitación nueva al mismo correo invalida el enlace anterior', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    const viejo = tokenDe(email);
    await invitar(email).expect(201);
    const nuevo = tokenDe(email);
    expect(nuevo).not.toBe(viejo);

    const estadoViejo = await consultar(viejo).expect(200);
    expect(estadoViejo.body).toMatchObject({
      estado: 'invalida',
      motivo: 'reemplazada',
    });
    await aceptar(viejo, { password: PASSWORD_NUEVA, nombre: 'Viejo' }).expect(
      410,
    );
    await consultar(nuevo)
      .expect(200)
      .expect((r) =>
        expect((r.body as { estado: string }).estado).toBe('vigente'),
      );
    const vivas = await filas(
      ds,
      `SELECT 1 FROM invitaciones
        WHERE company_id = $1 AND email = $2
          AND consumida_en IS NULL AND reemplazada_en IS NULL`,
      [empresaId, email],
    );
    expect(vivas).toHaveLength(1);
  });

  it('empresa desconocida: 404', async () => {
    await invitar(
      correoNuevo(),
      cookieDueno,
      '0198b2f0-0000-7000-8000-000000000000',
    ).expect(404);
    expect(correo.enviados).toHaveLength(0);
  });

  it('solo el dueño: una sesión de empresa recibe 403 y sin sesión 401', async () => {
    const cookieEmpresa = await abrirSesion(ds, anaId, ferreteriaId);
    await invitar(correoNuevo(), cookieEmpresa).expect(403);
    await http()
      .post(`/plataforma/empresas/${empresaId}/invitaciones`)
      .send({ email: correoNuevo() })
      .expect(401);
    expect(correo.enviados).toHaveLength(0);
  });

  it('rechaza un correo inválido con 400', async () => {
    await invitar('no-es-correo').expect(400);
  });

  it('el límite cuenta también los envíos exitosos', async () => {
    for (let i = 0; i < 20; i++) {
      await invitar(correoNuevo()).expect(201);
    }
    const res = await invitar(correoNuevo()).expect(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('GET /auth/invitaciones/:token', () => {
  it('vigente: nombre de la empresa y si hay que elegir contraseña', async () => {
    const nuevo = correoNuevo();
    await invitar(nuevo).expect(201);
    await invitar(ANA).expect(201);

    const resNuevo = await consultar(tokenDe(nuevo)).expect(200);
    expect(resNuevo.body).toEqual({
      estado: 'vigente',
      motivo: null,
      empresa: 'Invitadora SA de CV',
      requierePassword: true,
    });
    const resAna = await consultar(tokenDe(ANA)).expect(200);
    expect(resAna.body).toEqual({
      estado: 'vigente',
      motivo: null,
      empresa: 'Invitadora SA de CV',
      requierePassword: false,
    });
  });

  it('token desconocido: misma forma, sin datos de empresa', async () => {
    const res = await consultar('x'.repeat(43)).expect(200);
    expect(res.body).toEqual({
      estado: 'invalida',
      motivo: 'desconocida',
      empresa: null,
      requierePassword: null,
    });
  });

  it('caducada y usada se distinguen', async () => {
    const caducada = correoNuevo();
    await invitar(caducada).expect(201);
    await ds.query(
      `UPDATE invitaciones SET expires_at = now() - interval '1 minute' WHERE email = $1`,
      [caducada],
    );
    const res = await consultar(tokenDe(caducada)).expect(200);
    expect(res.body).toEqual({
      estado: 'invalida',
      motivo: 'caducada',
      empresa: null,
      requierePassword: null,
    });

    const usada = correoNuevo();
    await invitar(usada).expect(201);
    await aceptar(tokenDe(usada), {
      password: PASSWORD_NUEVA,
      nombre: 'Persona Usada',
    }).expect(200);
    const res2 = await consultar(tokenDe(usada)).expect(200);
    expect(res2.body).toMatchObject({ estado: 'invalida', motivo: 'usada' });
  });

  it('cancelada se distingue de reemplazada y de caducada (historia 2.4)', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    // Caducada y cancelada a la vez: el motivo es la cancelación.
    await ds.query(
      `UPDATE invitaciones
          SET cancelada_en = now(), expires_at = now() - interval '1 minute'
        WHERE email = $1`,
      [email],
    );
    const res = await consultar(tokenDe(email)).expect(200);
    expect(res.body).toEqual({
      estado: 'invalida',
      motivo: 'cancelada',
      empresa: null,
      requierePassword: null,
    });
  });
});

describe('POST /auth/invitaciones/:token/aceptar', () => {
  it('cuenta nueva: crea el usuario con su contraseña, da admin, consume y abre sesión', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    const token = tokenDe(email);

    const res = await aceptar(token, {
      password: PASSWORD_NUEVA,
      nombre: 'Persona Nueva',
    }).expect(200);

    expect(res.body).toEqual({
      companyId: empresaId,
      razonSocial: 'Invitadora SA de CV',
      cuentaNueva: true,
    });
    const fija = setCookieDe(res) as string;
    expect(fija).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toContain(token);

    const usuario = await una<{
      id: string;
      nombre: string;
      password_hash: string;
    }>(ds, `SELECT id, nombre, password_hash FROM users WHERE email = $1`, [
      email,
    ]);
    expect(usuario.nombre).toBe('Persona Nueva');
    expect(
      await new PasswordHasher().verificar(
        PASSWORD_NUEVA,
        usuario.password_hash,
      ),
    ).toBe(true);
    const roles = await filas<{ rol: string }>(
      ds,
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [usuario.id, empresaId],
    );
    expect(roles).toEqual([{ rol: 'admin' }]);
    const inv = await una<{ consumida_en: Date | null }>(
      ds,
      `SELECT consumida_en FROM invitaciones WHERE token_hash = $1`,
      [huellaDeToken(token)],
    );
    expect(inv.consumida_en).not.toBeNull();
    const sesion = await una<{ tipo: string; company_id: string }>(
      ds,
      `SELECT tipo, company_id FROM sesiones WHERE user_id = $1`,
      [usuario.id],
    );
    expect(sesion).toEqual({ tipo: 'empresa', company_id: empresaId });

    const contexto = await http()
      .get('/auth/contexto')
      .set('Cookie', cookieDe(res))
      .expect(200);
    expect(JSON.stringify(contexto.body)).toContain(empresaId);
  });

  it('cuenta existente: no toca su contraseña aunque el cuerpo traiga una', async () => {
    const email = `existente@${DOMINIO}`;
    const hashOriginal = await new PasswordHasher().hashear(
      'clave-original-123',
    );
    await ds.query(
      `INSERT INTO users (email, nombre, password_hash) VALUES ($1, 'Existente', $2)
       ON CONFLICT DO NOTHING`,
      [email, hashOriginal],
    );
    await invitar(email).expect(201);
    const token = tokenDe(email);

    const res = await aceptar(token, {
      password: 'otra-clave-que-debe-ignorarse',
      nombre: 'Otro Nombre',
    }).expect(200);

    expect(res.body).toMatchObject({
      companyId: empresaId,
      cuentaNueva: false,
    });
    const usuario = await una<{
      id: string;
      nombre: string;
      password_hash: string;
    }>(ds, `SELECT id, nombre, password_hash FROM users WHERE email = $1`, [
      email,
    ]);
    expect(usuario.password_hash).toBe(hashOriginal);
    expect(usuario.nombre).toBe('Existente');
    const roles = await filas<{ rol: string }>(
      ds,
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [usuario.id, empresaId],
    );
    expect(roles).toEqual([{ rol: 'admin' }]);
    // Y sin enviar contraseña también basta.
    const otra = `existente2@${DOMINIO}`;
    await ds.query(
      `INSERT INTO users (email, nombre, password_hash) VALUES ($1, 'Dos', $2)`,
      [otra, hashOriginal],
    );
    await invitar(otra).expect(201);
    await aceptar(tokenDe(otra)).expect(200);
  });

  it('cuenta nueva sin contraseña o con una corta: 400 y la invitación sigue viva', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    const token = tokenDe(email);

    await aceptar(token, { nombre: 'Sin Clave' }).expect(400);
    await aceptar(token, { password: 'corta', nombre: 'Clave Corta' }).expect(
      400,
    );
    await aceptar(token, { password: PASSWORD_NUEVA }).expect(400);

    const usuarios = await filas(ds, `SELECT 1 FROM users WHERE email = $1`, [
      email,
    ]);
    expect(usuarios).toHaveLength(0);
    const estado = await consultar(token).expect(200);
    expect((estado.body as { estado: string }).estado).toBe('vigente');
  });

  it('enlace usado: 410 y no cambia nada', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    const token = tokenDe(email);
    await aceptar(token, {
      password: PASSWORD_NUEVA,
      nombre: 'Una Vez',
    }).expect(200);

    const res = await aceptar(token, {
      password: 'otra-contraseña-larga-1',
      nombre: 'Dos Veces',
    }).expect(410);

    expect(res.body).toMatchObject({ motivo: 'usada' });
    expect(setCookieDe(res)).toBeUndefined();
    const usuario = await una<{ nombre: string }>(
      ds,
      `SELECT nombre FROM users WHERE email = $1`,
      [email],
    );
    expect(usuario.nombre).toBe('Una Vez');
  });

  it('enlace caducado: 410 y no crea la cuenta', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    await ds.query(
      `UPDATE invitaciones SET expires_at = now() - interval '1 second' WHERE email = $1`,
      [email],
    );

    const res = await aceptar(tokenDe(email), {
      password: PASSWORD_NUEVA,
      nombre: 'Tarde',
    }).expect(410);

    expect(res.body).toMatchObject({ motivo: 'caducada' });
    const usuarios = await filas(ds, `SELECT 1 FROM users WHERE email = $1`, [
      email,
    ]);
    expect(usuarios).toHaveLength(0);
  });

  it('enlace cancelado: 410 con motivo cancelada y no crea la cuenta (historia 2.4)', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    await ds.query(
      `UPDATE invitaciones SET cancelada_en = now() WHERE email = $1`,
      [email],
    );

    const res = await aceptar(tokenDe(email), {
      password: PASSWORD_NUEVA,
      nombre: 'Cancelada',
    }).expect(410);

    expect(res.body).toMatchObject({
      motivo: 'cancelada',
      message:
        'Esta invitación fue cancelada. Pide a un administrador que te invite de nuevo.',
    });
    const usuarios = await filas(ds, `SELECT 1 FROM users WHERE email = $1`, [
      email,
    ]);
    expect(usuarios).toHaveLength(0);
  });

  it('token desconocido: 404', async () => {
    await aceptar('y'.repeat(43), {
      password: PASSWORD_NUEVA,
      nombre: 'Nadie',
    }).expect(404);
  });

  it('aceptaciones concurrentes: exactamente una tiene éxito', async () => {
    const email = correoNuevo();
    await invitar(email).expect(201);
    const token = tokenDe(email);

    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        aceptar(token, { password: PASSWORD_NUEVA, nombre: 'Carrera' }),
      ),
    );

    const estados = respuestas.map((r) => r.status).sort();
    expect(estados).toEqual([200, 410, 410, 410, 410]);
    const usuarios = await filas(ds, `SELECT 1 FROM users WHERE email = $1`, [
      email,
    ]);
    expect(usuarios).toHaveLength(1);
    const sesiones = await filas(
      ds,
      `SELECT 1 FROM sesiones s JOIN users u ON u.id = s.user_id WHERE u.email = $1`,
      [email],
    );
    expect(sesiones).toHaveLength(1);
  });

  /** Invitación de empresa (historia 2.3) con varios roles, sin pasar por la ruta. */
  async function invitacionConRoles(
    email: string,
    roles: string[],
  ): Promise<string> {
    const token = nuevoToken();
    await ds.query(
      `INSERT INTO invitaciones (company_id, email, roles, token_hash, expires_at, invitada_por_user_id)
       VALUES ($1, $2, $3::text[], $4, now() + interval '7 days', $5)`,
      [empresaId, email, roles, huellaDeToken(token), anaId],
    );
    return token;
  }

  it('cuenta nueva: recibe todos los roles de la invitación (historia 2.3)', async () => {
    const email = correoNuevo();
    const token = await invitacionConRoles(email, ['contador', 'revisor']);

    await aceptar(token, {
      password: PASSWORD_NUEVA,
      nombre: 'Varios Roles',
    }).expect(200);

    const roles = await filas<{ rol: string }>(
      ds,
      `SELECT r.rol FROM user_company_roles r JOIN users u ON u.id = r.user_id
        WHERE u.email = $1 AND r.company_id = $2 ORDER BY r.rol`,
      [email, empresaId],
    );
    expect(roles).toEqual([{ rol: 'contador' }, { rol: 'revisor' }]);
  });

  it('cuenta existente: suma los roles, no duplica y conserva los de otras empresas (historia 2.3)', async () => {
    const email = `multirol@${DOMINIO}`;
    const { id: userId } = await una<{ id: string }>(
      ds,
      `INSERT INTO users (email, nombre, password_hash) VALUES ($1, 'Multirol', 'h') RETURNING id`,
      [email],
    );
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol) VALUES ($1, $2, 'contador'), ($1, $3, 'revisor')`,
      [userId, ferreteriaId, empresaId],
    );
    const token = await invitacionConRoles(email, ['revisor', 'auditor']);

    const res = await aceptar(token).expect(200);

    expect(res.body).toMatchObject({ cuentaNueva: false });
    const enEmpresa = await filas<{ rol: string }>(
      ds,
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2 ORDER BY rol`,
      [userId, empresaId],
    );
    expect(enEmpresa).toEqual([{ rol: 'auditor' }, { rol: 'revisor' }]);
    const enOtra = await filas<{ rol: string }>(
      ds,
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [userId, ferreteriaId],
    );
    expect(enOtra).toEqual([{ rol: 'contador' }]);
    await ds.query(`DELETE FROM user_company_roles WHERE user_id = $1`, [
      userId,
    ]);
  });

  it('los intentos fallidos cuentan para el límite', async () => {
    for (let i = 0; i < 10; i++) {
      await aceptar('z'.repeat(43), { password: PASSWORD_NUEVA }).expect(404);
    }
    await aceptar('z'.repeat(43), { password: PASSWORD_NUEVA }).expect(429);
  });
});
