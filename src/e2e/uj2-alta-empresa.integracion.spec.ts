import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password';
import { permisosDeRoles } from '../auth/permisos/matriz';
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
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import { cookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { UsuariosModule } from '../usuarios/usuarios.module';
import type { Rol } from '../common/entities/tipos';

const PREFIJO_LIMITE = 'cuadra_test_uj2';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 7.2 (FR-70, AD-18). UJ-2, «Carlos deja lista su empresa», de punta a
 * punta por HTTP: la API, Postgres y Redis reales (la app corre como
 * cuadra_app, sujeta a RLS) y el correo simulado. Un solo recorrido encadenado:
 * cada paso usa lo que dejó el anterior.
 */

const CORREO_DUENO = 'dueno-uj2@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const PASSWORD = 'contraseña-nueva-segura';
const DOMINIO = 'uj2.test';
const RFC_A = 'UJD240101AB1';
const RFC_B = 'UJD240202BC2';

let app: INestApplication<App>;
let ds: DataSource;
let correo: CorreoSimulado;
let cookieDueno: string;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  // No hay ruta para sembrar al dueño de la plataforma.
  const hash = await new PasswordHasher().hashear(PASSWORD_DUENO);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hash],
  );

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
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
}, 60_000);

afterAll(async () => {
  jest.restoreAllMocks();
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    // Las bitácoras son de solo agregar para cuadra_app; el dueño limpia.
    const empresas = `(SELECT id FROM companies WHERE rfc = ANY($1))`;
    const rfcs = [[RFC_A, RFC_B]];
    const personas = `(SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`;
    await ds.query(`DELETE FROM sesiones WHERE user_id IN ${personas}`);
    await ds.query(
      `DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL`,
    );
    await ds.query(
      `DELETE FROM user_company_roles WHERE company_id IN ${empresas} OR user_id IN ${personas}`,
      rfcs,
    );
    await ds.query(
      `DELETE FROM invitaciones WHERE company_id IN ${empresas}`,
      rfcs,
    );
    await ds.query(
      `DELETE FROM bitacora WHERE company_id IN ${empresas}`,
      rfcs,
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    await ds.query(`DELETE FROM bitacora_plataforma`);
    await ds.query(`DELETE FROM companies WHERE rfc = ANY($1)`, rfcs);
    await ds.query(`DELETE FROM plataforma_usuarios WHERE correo = $1`, [
      CORREO_DUENO,
    ]);
    await ds.destroy();
  }
});

const http = () => request(app.getHttpServer());

/** Token del último correo enviado a `para`, leído del enlace del correo simulado. */
function tokenDe(para: string): string {
  const mensaje = correo.ultimoPara(para);
  const m = /\/invitacion\/([A-Za-z0-9_-]+)/.exec(mensaje?.texto ?? '');
  if (!m) throw new Error(`No hubo correo con enlace para ${para}`);
  return m[1];
}

async function aceptar(
  para: string,
  nombre: string,
): Promise<{ cookie: string; cuentaNueva: boolean; companyId: string }> {
  const res = await http()
    .post(`/auth/invitaciones/${tokenDe(para)}/aceptar`)
    .send({ nombre, password: PASSWORD })
    .expect(200);
  const cuerpo = res.body as { cuentaNueva: boolean; companyId: string };
  return { cookie: cookieDe(res), ...cuerpo };
}

interface Contexto {
  empresa: { id: string; rfc: string };
  roles: string[];
  capacidades: string[];
}
const contexto = async (cookie: string) =>
  (await http().get('/auth/contexto').set('Cookie', cookie).expect(200))
    .body as Contexto;

const invitar = (cookie: string, email: string, roles: Rol[]) =>
  http().post('/usuarios/invitaciones').set('Cookie', cookie).send({
    email,
    roles,
  });

const correoDe = (nombre: string) => `${nombre}@${DOMINIO}`;

interface UsuarioListado {
  id: string;
  email: string;
  roles: string[];
  invitacionId: string | null;
}
const listar = async (cookie: string) =>
  (await http().get('/usuarios').set('Cookie', cookie).expect(200))
    .body as UsuarioListado[];

describe('UJ-2: Carlos deja lista su empresa (FR-70, AD-18)', () => {
  let empresaA: string;
  let empresaB: string;
  let carlosA: string;
  let carlosB: string;
  let carlosId: string;

  it('el dueño inicia sesión, crea la empresa, invita a Carlos y Carlos acepta leyendo el enlace del correo', async () => {
    const login = await http()
      .post('/plataforma/auth/login')
      .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
      .expect(200);
    cookieDueno = cookieDe(login);

    const creada = await http()
      .post('/plataforma/empresas')
      .set('Cookie', cookieDueno)
      .send({ razonSocial: 'Empresa de Carlos SA de CV', rfc: RFC_A })
      .expect(201);
    empresaA = (creada.body as { id: string }).id;

    await http()
      .post(`/plataforma/empresas/${empresaA}/invitaciones`)
      .set('Cookie', cookieDueno)
      .send({ email: correoDe('carlos') })
      .expect(201);

    const token = tokenDe(correoDe('carlos'));
    expect(
      (await http().get(`/auth/invitaciones/${token}`).expect(200)).body,
    ).toMatchObject({ estado: 'vigente', requierePassword: true });

    const aceptada = await aceptar(correoDe('carlos'), 'Carlos');
    expect(aceptada).toMatchObject({ cuentaNueva: true, companyId: empresaA });
    carlosA = aceptada.cookie;

    const ctx = await contexto(carlosA);
    expect(ctx.empresa).toMatchObject({ id: empresaA, rfc: RFC_A });
    expect(ctx.roles).toEqual(['admin']);
    expect(ctx.capacidades).toEqual(permisosDeRoles(['admin']));
  });

  it('Carlos invita a tres personas con roles distintos: cada una acepta y su menú es exactamente el de su rol', async () => {
    const equipo: Array<[string, Rol]> = [
      ['marisol', 'contador'],
      ['ricardo', 'revisor'],
      ['paola', 'auditor'],
    ];
    for (const [nombre, rol] of equipo) {
      await invitar(carlosA, correoDe(nombre), [rol]).expect(201);
      const { cookie, cuentaNueva } = await aceptar(correoDe(nombre), nombre);
      expect(cuentaNueva).toBe(true);

      const ctx = await contexto(cookie);
      expect(ctx.roles).toEqual([rol]);
      expect(ctx.capacidades).toEqual(permisosDeRoles([rol]));
      // Ninguna de las tres ve la administración de usuarios.
      expect(ctx.capacidades).not.toContain('usuarios.gestionar');
      await http().get('/usuarios').set('Cookie', cookie).expect(403);
    }
    // Y el menú de cada rol es distinto del de un administrador.
    expect(permisosDeRoles(['admin'])).toContain('usuarios.gestionar');
  });

  it('al reenviar una invitación pendiente, el enlace anterior deja de servir y el nuevo funciona', async () => {
    await invitar(carlosA, correoDe('lucia'), ['revisor']).expect(201);
    const viejo = tokenDe(correoDe('lucia'));
    const pendiente = (await listar(carlosA)).find(
      (u) => u.email === correoDe('lucia'),
    );
    expect(pendiente?.invitacionId).toBeTruthy();

    await http()
      .post(`/usuarios/invitaciones/${pendiente?.invitacionId}/reenviar`)
      .set('Cookie', carlosA)
      .expect(201);
    const nuevo = tokenDe(correoDe('lucia'));
    expect(nuevo).not.toBe(viejo);

    expect(
      (await http().get(`/auth/invitaciones/${viejo}`).expect(200)).body,
    ).toMatchObject({ estado: 'invalida', motivo: 'reemplazada' });
    await http()
      .post(`/auth/invitaciones/${viejo}/aceptar`)
      .send({ nombre: 'Lucía', password: PASSWORD })
      .expect(410);

    expect(
      (await http().get(`/auth/invitaciones/${nuevo}`).expect(200)).body,
    ).toMatchObject({ estado: 'vigente' });
    const aceptada = await aceptar(correoDe('lucia'), 'Lucía');
    expect(aceptada.companyId).toBe(empresaA);
  });

  it('el único administrador no puede quedarse sin su rol: se rechaza', async () => {
    carlosId = (await listar(carlosA)).find(
      (u) => u.email === correoDe('carlos'),
    )!.id;

    await http()
      .delete(`/usuarios/${carlosId}/roles`)
      .set('Cookie', carlosA)
      .expect(409);
    await http()
      .patch(`/usuarios/${carlosId}/roles`)
      .set('Cookie', carlosA)
      .send({ roles: ['contador'] })
      .expect(409);

    // Nada cambió: sigue siendo administrador.
    expect((await contexto(carlosA)).roles).toEqual(['admin']);
  });

  it('a un administrador al que se le quita el rol de una empresa: pierde esa empresa en su siguiente petición y conserva la otra', async () => {
    // Carlos también administra una segunda empresa (su cuenta ya existe).
    const creada = await http()
      .post('/plataforma/empresas')
      .set('Cookie', cookieDueno)
      .send({ razonSocial: 'Segunda de Carlos SA de CV', rfc: RFC_B })
      .expect(201);
    empresaB = (creada.body as { id: string }).id;
    await http()
      .post(`/plataforma/empresas/${empresaB}/invitaciones`)
      .set('Cookie', cookieDueno)
      .send({ email: correoDe('carlos') })
      .expect(201);
    const enB = await aceptar(correoDe('carlos'), 'Carlos');
    expect(enB).toMatchObject({ cuentaNueva: false, companyId: empresaB });
    carlosB = enB.cookie;
    expect((await contexto(carlosB)).empresa.id).toBe(empresaB);

    // En la empresa A hace falta otra administradora que le quite el rol.
    await invitar(carlosA, correoDe('marta'), ['admin']).expect(201);
    const marta = await aceptar(correoDe('marta'), 'Marta');
    await http()
      .delete(`/usuarios/${carlosId}/roles`)
      .set('Cookie', marta.cookie)
      .expect(200);

    // Su sesión de A deja de servir en la siguiente petición…
    await http().get('/auth/contexto').set('Cookie', carlosA).expect(401);
    // …y la de B sigue intacta.
    expect((await contexto(carlosB)).empresa.id).toBe(empresaB);
    const empresas = await http()
      .get('/auth/empresas')
      .set('Cookie', carlosB)
      .expect(200);
    expect((empresas.body as Array<{ id: string }>).map((e) => e.id)).toEqual([
      empresaB,
    ]);
    // La empresa A sigue con administradora: Marta.
    expect((await contexto(marta.cookie)).roles).toEqual(['admin']);
  });
});
