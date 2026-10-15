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
let otraEmpresaId: string;
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
  otraEmpresaId = (
    await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ('OTR010101AB1', 'Otra Empresa SA')
       ON CONFLICT (rfc) DO UPDATE SET razon_social = 'Otra Empresa SA'
       RETURNING id`,
    )
  ).id;
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
         AND accion IN ('invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'acceso_denegado')`,
      [empresaId, inicio],
    );
    // Historia 2.4: la empresa ajena.
    await ds.query(`DELETE FROM invitaciones WHERE company_id = $1`, [
      otraEmpresaId,
    ]);
    await ds.query(`DELETE FROM companies WHERE id = $1`, [otraEmpresaId]);
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

describe('invitaciones pendientes: listar, reenviar y cancelar (historia 2.4)', () => {
  const listar = (cookie: string = cookieAna) =>
    http().get('/usuarios/invitaciones').set('Cookie', cookie);
  const reenviar = (id: string, cookie: string = cookieAna) =>
    http().post(`/usuarios/invitaciones/${id}/reenviar`).set('Cookie', cookie);
  const cancelar = (id: string, cookie: string = cookieAna) =>
    http().post(`/usuarios/invitaciones/${id}/cancelar`).set('Cookie', cookie);

  const vivaDe = async (email: string): Promise<string> =>
    (
      await una<{ id: string }>(
        ds,
        `SELECT id FROM invitaciones
          WHERE company_id = $1 AND email = $2
            AND consumida_en IS NULL AND reemplazada_en IS NULL
            AND cancelada_en IS NULL`,
        [empresaId, email],
      )
    ).id;

  const invitacionesDe = (email: string) =>
    filas<{ id: string }>(ds, `SELECT id FROM invitaciones WHERE email = $1`, [
      email,
    ]);

  const bitacoraDe = (accion: string, email: string) =>
    filas<{
      user_id: string;
      entidad: string;
      entidad_id: string;
      datos: { invitacionId: string; email: string; roles: string[] };
    }>(
      ds,
      `SELECT user_id, entidad, entidad_id, datos FROM bitacora
        WHERE company_id = $1 AND accion = $2 AND datos->>'email' = $3`,
      [empresaId, accion, email],
    );

  const invitarYObtener = async (
    roles: string[] = ['contador'],
  ): Promise<{ email: string; id: string }> => {
    const email = correoNuevo();
    await invitar({ email, roles }).expect(201);
    return { email, id: await vivaDe(email) };
  };

  describe('GET /usuarios/invitaciones', () => {
    it('lista solo las pendientes de la empresa; las vencidas salen como vencida', async () => {
      const pendiente = await invitarYObtener(['contador', 'revisor']);
      const vencida = await invitarYObtener();
      await ds.query(
        `UPDATE invitaciones SET expires_at = now() - interval '1 minute' WHERE id = $1`,
        [vencida.id],
      );
      const consumida = await invitarYObtener();
      await http()
        .post(`/auth/invitaciones/${tokenDe(consumida.email)}/aceptar`)
        .send({ password: PASSWORD_NUEVA, nombre: 'Consumida' })
        .expect(200);
      const reemplazada = correoNuevo();
      await invitar({ email: reemplazada, roles: ['revisor'] }).expect(201);
      await invitar({ email: reemplazada, roles: ['revisor'] }).expect(201);
      const cancelada = await invitarYObtener();
      await cancelar(cancelada.id).expect(200);
      const ajena = correoNuevo();
      await ds.query(
        `INSERT INTO invitaciones (company_id, email, roles, token_hash, expires_at, invitada_por_user_id)
         VALUES ($1, $2, ARRAY['admin'], $3, now() + interval '7 days', $4)`,
        [otraEmpresaId, ajena, `hash-ajena-${ajena}`, anaId],
      );

      const res = await listar().expect(200);
      const lista = res.body as Array<{ email: string; id: string }>;
      const correos = lista.map((i) => i.email);

      expect(correos).toEqual(
        expect.arrayContaining([pendiente.email, vencida.email, reemplazada]),
      );
      for (const fuera of [consumida.email, cancelada.email, ajena]) {
        expect(correos).not.toContain(fuera);
      }
      // La reemplazada aparece una sola vez: la nueva.
      expect(correos.filter((c) => c === reemplazada)).toHaveLength(1);
      const { nombre } = await una<{ nombre: string }>(
        ds,
        `SELECT nombre FROM users WHERE id = $1`,
        [anaId],
      );
      expect(lista.find((i) => i.email === pendiente.email)).toEqual({
        id: pendiente.id,
        email: pendiente.email,
        roles: ['contador', 'revisor'],
        creadaEn: expect.any(String) as string,
        venceEn: expect.any(String) as string,
        vencida: false,
        invitadaPor: nombre,
      });
      expect(lista.find((i) => i.email === vencida.email)).toMatchObject({
        id: vencida.id,
        vencida: true,
      });
    });

    it('nunca trae el token ni su huella', async () => {
      const { email } = await invitarYObtener(['admin']);
      const res = await listar().expect(200);
      expect(
        (res.body as Array<{ email: string }>).some((i) => i.email === email),
      ).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain(
        huellaDeToken(tokenDe(email)),
      );
      expect(JSON.stringify(res.body)).not.toContain(tokenDe(email));
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    });

    it('sin rol admin: 403 y deja acceso denegado con usuarios.ver', async () => {
      const res = await listar(cookieLuis);
      expect(res.status).toBe(403);
      const denegado = await una<{ datos: Record<string, unknown> }>(
        ds,
        `SELECT datos FROM bitacora
          WHERE company_id = $1 AND accion = 'acceso_denegado' AND created_at >= $2
            AND datos->>'ruta' = '/usuarios/invitaciones'
            AND datos->>'permiso' = 'usuarios.ver'`,
        [empresaId, inicio],
      );
      expect(denegado.datos).toMatchObject({ motivo: 'rol_insuficiente' });
    });

    it('sin sesión: 401', async () => {
      await http().get('/usuarios/invitaciones').expect(401);
    });
  });

  describe('POST /usuarios/invitaciones/:id/reenviar', () => {
    it('da un enlace nuevo con 7 días, invalida el anterior y conserva correo y roles', async () => {
      const { email, id } = await invitarYObtener(['contador', 'auditor']);
      const viejo = tokenDe(email);
      // La invitó otra persona y ya venció: reenviar renueva y registra a quien reenvía.
      await ds.query(
        `UPDATE invitaciones
            SET invitada_por_user_id = $2, expires_at = now() - interval '1 day'
          WHERE id = $1`,
        [id, luisId],
      );
      correo.limpiar();

      const res = await reenviar(id).expect(201);

      expect(res.body).toEqual({ email, roles: ['contador', 'auditor'] });
      const nuevo = tokenDe(email);
      expect(nuevo).not.toBe(viejo);
      expect(correo.ultimoPara(email)?.texto).toContain(
        `${process.env.ORIGEN_AUTORIZADO}/invitacion/${nuevo}`,
      );
      const antes = await http().get(`/auth/invitaciones/${viejo}`).expect(200);
      expect(antes.body).toMatchObject({
        estado: 'invalida',
        motivo: 'reemplazada',
      });
      const despues = await http()
        .get(`/auth/invitaciones/${nuevo}`)
        .expect(200);
      expect(despues.body).toMatchObject({ estado: 'vigente' });
      const fila = await una<Record<string, unknown>>(
        ds,
        `SELECT token_hash, roles, invitada_por_user_id,
                round(extract(epoch FROM (expires_at - now())) / 86400)::int AS dias
           FROM invitaciones WHERE id = $1`,
        [await vivaDe(email)],
      );
      expect(fila).toEqual({
        token_hash: huellaDeToken(nuevo),
        roles: ['contador', 'auditor'],
        invitada_por_user_id: anaId,
        dias: 7,
      });
      // Una sola viva y la vieja marcada como reemplazada.
      expect(await invitacionesDe(email)).toHaveLength(2);
      const vieja = await una<{ reemplazada: boolean }>(
        ds,
        `SELECT reemplazada_en IS NOT NULL AS reemplazada FROM invitaciones WHERE id = $1`,
        [id],
      );
      expect(vieja.reemplazada).toBe(true);
    });

    it('el enlace nuevo se acepta con los mismos roles', async () => {
      const { email, id } = await invitarYObtener(['revisor', 'auditor']);
      await reenviar(id).expect(201);
      await http()
        .post(`/auth/invitaciones/${tokenDe(email)}/aceptar`)
        .send({ password: PASSWORD_NUEVA, nombre: 'Reenviada' })
        .expect(200);
      const roles = await filas<{ rol: string }>(
        ds,
        `SELECT r.rol FROM user_company_roles r JOIN users u ON u.id = r.user_id
          WHERE u.email = $1 AND r.company_id = $2 ORDER BY r.rol`,
        [email, empresaId],
      );
      expect(roles).toEqual([{ rol: 'auditor' }, { rol: 'revisor' }]);
    });

    it('deja reenviar_invitacion en la bitácora con quién y cuándo', async () => {
      const { email, id } = await invitarYObtener(['contador']);
      await reenviar(id).expect(201);

      const nuevaId = await vivaDe(email);
      const [fila] = await bitacoraDe('reenviar_invitacion', email);
      expect(fila.user_id).toBe(anaId);
      expect(fila.entidad).toBe('companies');
      expect(fila.entidad_id).toBe(empresaId);
      expect(fila.datos).toMatchObject({
        invitacionId: nuevaId,
        anteriorId: id,
        email,
        roles: ['contador'],
      });
      expect(JSON.stringify(fila.datos)).not.toContain(tokenDe(email));
      const { creada } = await una<{ creada: Date }>(
        ds,
        `SELECT created_at AS creada FROM bitacora
          WHERE company_id = $1 AND accion = 'reenviar_invitacion' AND datos->>'email' = $2`,
        [empresaId, email],
      );
      expect(creada.getTime()).toBeGreaterThanOrEqual(inicio.getTime());
    });

    it('ya aceptada: 409 con mensaje claro y no cambia nada', async () => {
      const { email, id } = await invitarYObtener();
      await http()
        .post(`/auth/invitaciones/${tokenDe(email)}/aceptar`)
        .send({ password: PASSWORD_NUEVA, nombre: 'Aceptada' })
        .expect(200);
      correo.limpiar();

      const res = await reenviar(id).expect(409);

      expect(JSON.stringify(res.body)).toContain(
        'Esta invitación ya fue aceptada y no se puede reenviar.',
      );
      expect(correo.enviados).toHaveLength(0);
      expect(await invitacionesDe(email)).toHaveLength(1);
      expect(await bitacoraDe('reenviar_invitacion', email)).toHaveLength(0);
    });

    it('reemplazada o cancelada: 409 «ya no está pendiente» y no cambia nada', async () => {
      const reemplazada = await invitarYObtener();
      await invitar({ email: reemplazada.email, roles: ['revisor'] }).expect(
        201,
      );
      const cancelada = await invitarYObtener();
      await cancelar(cancelada.id).expect(200);
      correo.limpiar();

      for (const { id, email } of [reemplazada, cancelada]) {
        const res = await reenviar(id).expect(409);
        expect(JSON.stringify(res.body)).toContain(
          'Esta invitación ya no está pendiente.',
        );
        expect(await bitacoraDe('reenviar_invitacion', email)).toHaveLength(0);
      }
      expect(correo.enviados).toHaveLength(0);
      expect(await invitacionesDe(reemplazada.email)).toHaveLength(2);
      expect(await invitacionesDe(cancelada.email)).toHaveLength(1);
    });

    it('de otra empresa o inexistente: 404; un id que no es uuid: 400', async () => {
      const ajena = correoNuevo();
      const { id } = await una<{ id: string }>(
        ds,
        `INSERT INTO invitaciones (company_id, email, roles, token_hash, expires_at, invitada_por_user_id)
         VALUES ($1, $2, ARRAY['admin'], $3, now() + interval '7 days', $4) RETURNING id`,
        [otraEmpresaId, ajena, `hash-reenviar-${ajena}`, anaId],
      );
      await reenviar(id).expect(404);
      await reenviar('00000000-0000-4000-8000-000000000000').expect(404);
      await reenviar('no-es-uuid').expect(400);
      const intacta = await una<{ n: number }>(
        ds,
        `SELECT count(*)::int AS n FROM invitaciones
          WHERE company_id = $1 AND email = $2 AND reemplazada_en IS NULL`,
        [otraEmpresaId, ajena],
      );
      expect(intacta.n).toBe(1);
      expect(correo.enviados).toHaveLength(0);
    });

    it('sin rol admin: 403, no cambia nada y deja acceso denegado con usuarios.gestionar', async () => {
      const { email, id } = await invitarYObtener();
      correo.limpiar();

      const res = await reenviar(id, cookieLuis);

      expect(res.status).toBe(403);
      expect(correo.enviados).toHaveLength(0);
      expect(await invitacionesDe(email)).toHaveLength(1);
      const denegado = await una<{ datos: Record<string, unknown> }>(
        ds,
        `SELECT datos FROM bitacora
          WHERE company_id = $1 AND accion = 'acceso_denegado' AND created_at >= $2
            AND datos->>'ruta' = $3`,
        [empresaId, inicio, `/usuarios/invitaciones/${id}/reenviar`],
      );
      expect(denegado.datos).toMatchObject({
        permiso: 'usuarios.gestionar',
        motivo: 'rol_insuficiente',
      });
    });

    it('si el correo falla: 503 como invitar', async () => {
      const { id } = await invitarYObtener();
      jest
        .spyOn(correo, 'enviar')
        .mockRejectedValueOnce(new Error('smtp caído'));
      const res = await reenviar(id).expect(503);
      expect(JSON.stringify(res.body)).toContain('No se pudo enviar el correo');
    });

    it('dos reenvíos simultáneos: uno gana y el otro recibe 409', async () => {
      const { email, id } = await invitarYObtener();
      const [a, b] = await Promise.all([reenviar(id), reenviar(id)]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const vivas = await filas(
        ds,
        `SELECT 1 FROM invitaciones
          WHERE company_id = $1 AND email = $2
            AND consumida_en IS NULL AND reemplazada_en IS NULL AND cancelada_en IS NULL`,
        [empresaId, email],
      );
      expect(vivas).toHaveLength(1);
    });

    it('si la bitácora falla no cambia la invitación ni sale correo', async () => {
      const { email, id } = await invitarYObtener();
      correo.limpiar();
      await ds.query(`
        CREATE OR REPLACE FUNCTION fallar_bitacora_24() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'bitacora caida a proposito'; END $$ LANGUAGE plpgsql`);
      await ds.query(
        `CREATE TRIGGER tg_fallar_bitacora_24 BEFORE INSERT ON bitacora
         FOR EACH ROW WHEN (NEW.accion IN ('reenviar_invitacion', 'cancelar_invitacion'))
         EXECUTE FUNCTION fallar_bitacora_24()`,
      );
      try {
        await reenviar(id).expect(500);
        await cancelar(id).expect(500);
        expect(correo.enviados).toHaveLength(0);
        expect(await invitacionesDe(email)).toHaveLength(1);
        expect(await vivaDe(email)).toBe(id);
      } finally {
        await ds.query(`DROP TRIGGER tg_fallar_bitacora_24 ON bitacora`);
        await ds.query('DROP FUNCTION fallar_bitacora_24()');
      }
    });

    it('el límite cuenta cada reenvío, también los exitosos', async () => {
      for (let i = 0; i < 20; i++) {
        await reenviar('00000000-0000-4000-8000-000000000000').expect(404);
      }
      const res = await reenviar('00000000-0000-4000-8000-000000000000').expect(
        429,
      );
      expect(res.headers['retry-after']).toBeDefined();
    });
  });

  describe('POST /usuarios/invitaciones/:id/cancelar', () => {
    it('deja el enlace sin servir con motivo cancelada, la saca de pendientes y libera el correo', async () => {
      const { email, id } = await invitarYObtener(['revisor']);
      const token = tokenDe(email);

      const res = await cancelar(id).expect(200);

      expect(res.body).toEqual({ email });
      const estado = await http()
        .get(`/auth/invitaciones/${token}`)
        .expect(200);
      expect(estado.body).toEqual({
        estado: 'invalida',
        motivo: 'cancelada',
        empresa: null,
        requierePassword: null,
      });
      await http()
        .post(`/auth/invitaciones/${token}/aceptar`)
        .send({ password: PASSWORD_NUEVA, nombre: 'Cancelada' })
        .expect(410);
      const lista = (await listar().expect(200)).body as Array<{
        email: string;
      }>;
      expect(lista.map((i) => i.email)).not.toContain(email);
      // No se borra y no se marca como reemplazada.
      const fila = await una<Record<string, boolean>>(
        ds,
        `SELECT cancelada_en IS NOT NULL AS cancelada,
                reemplazada_en IS NOT NULL AS reemplazada,
                consumida_en IS NOT NULL AS consumida
           FROM invitaciones WHERE id = $1`,
        [id],
      );
      expect(fila).toEqual({
        cancelada: true,
        reemplazada: false,
        consumida: false,
      });
      // El correo queda libre para invitar de nuevo.
      await invitar({ email, roles: ['revisor'] }).expect(201);
      expect(await invitacionesDe(email)).toHaveLength(2);
    });

    it('deja cancelar_invitacion en la bitácora con quién y cuándo, sin enviar correo', async () => {
      const { email, id } = await invitarYObtener(['contador', 'auditor']);
      correo.limpiar();
      await cancelar(id).expect(200);

      expect(correo.enviados).toHaveLength(0);
      const [fila] = await bitacoraDe('cancelar_invitacion', email);
      expect(fila.user_id).toBe(anaId);
      expect(fila.entidad).toBe('companies');
      expect(fila.entidad_id).toBe(empresaId);
      expect(fila.datos).toEqual({
        invitacionId: id,
        email,
        roles: ['contador', 'auditor'],
      });
    });

    it('ya aceptada: 409 con mensaje claro y no cambia nada', async () => {
      const { email, id } = await invitarYObtener();
      await http()
        .post(`/auth/invitaciones/${tokenDe(email)}/aceptar`)
        .send({ password: PASSWORD_NUEVA, nombre: 'Aceptada' })
        .expect(200);

      const res = await cancelar(id).expect(409);

      expect(JSON.stringify(res.body)).toContain(
        'Esta invitación ya fue aceptada y no se puede cancelar.',
      );
      const fila = await una<{ cancelada: boolean }>(
        ds,
        `SELECT cancelada_en IS NOT NULL AS cancelada FROM invitaciones WHERE id = $1`,
        [id],
      );
      expect(fila.cancelada).toBe(false);
      expect(await bitacoraDe('cancelar_invitacion', email)).toHaveLength(0);
    });

    it('ya cancelada o reemplazada: 409 «ya no está pendiente» y no cambia nada', async () => {
      const cancelada = await invitarYObtener();
      await cancelar(cancelada.id).expect(200);
      const reemplazada = await invitarYObtener();
      await invitar({ email: reemplazada.email, roles: ['revisor'] }).expect(
        201,
      );

      for (const { id } of [cancelada, reemplazada]) {
        const res = await cancelar(id).expect(409);
        expect(JSON.stringify(res.body)).toContain(
          'Esta invitación ya no está pendiente.',
        );
      }
      expect(
        await bitacoraDe('cancelar_invitacion', cancelada.email),
      ).toHaveLength(1);
      expect(
        await bitacoraDe('cancelar_invitacion', reemplazada.email),
      ).toHaveLength(0);
    });

    it('de otra empresa: 404 y la invitación sigue pendiente', async () => {
      const ajena = correoNuevo();
      const { id } = await una<{ id: string }>(
        ds,
        `INSERT INTO invitaciones (company_id, email, roles, token_hash, expires_at, invitada_por_user_id)
         VALUES ($1, $2, ARRAY['admin'], $3, now() + interval '7 days', $4) RETURNING id`,
        [otraEmpresaId, ajena, `hash-cancelar-${ajena}`, anaId],
      );
      await cancelar(id).expect(404);
      const fila = await una<{ cancelada: boolean }>(
        ds,
        `SELECT cancelada_en IS NOT NULL AS cancelada FROM invitaciones WHERE id = $1`,
        [id],
      );
      expect(fila.cancelada).toBe(false);
    });

    it('sin rol admin: 403 y la invitación sigue pendiente', async () => {
      const { id } = await invitarYObtener();
      const res = await cancelar(id, cookieLuis);
      expect(res.status).toBe(403);
      const fila = await una<{ cancelada: boolean }>(
        ds,
        `SELECT cancelada_en IS NOT NULL AS cancelada FROM invitaciones WHERE id = $1`,
        [id],
      );
      expect(fila.cancelada).toBe(false);
    });

    it('sin sesión: 401', async () => {
      await http()
        .post(
          '/usuarios/invitaciones/00000000-0000-4000-8000-000000000000/cancelar',
        )
        .expect(401);
    });

    it('el límite aplica a cancelar', async () => {
      for (let i = 0; i < 20; i++) {
        await cancelar('00000000-0000-4000-8000-000000000000').expect(404);
      }
      await cancelar('00000000-0000-4000-8000-000000000000').expect(429);
    });
  });
});
