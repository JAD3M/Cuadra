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
import type { Rol } from '../common/entities/tipos';
import { opcionesDataSource } from '../database/data-source';
import { ENTIDADES } from '../database/entidades';
import { SnakeNamingStrategy } from '../database/naming.strategy';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import { abrirSesion } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { UsuariosModule } from './usuarios.module';

const PREFIJO_LIMITE = 'cuadra_test_usuarios_listar';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 2.5 (FR-47): la lista de personas de la empresa en una sola tabla,
 * con su estado. Postgres y Redis reales; la app corre como cuadra_app.
 */

const ANA = 'ana.reyes@fdb.mx'; // admin de la ferretería
const JORGE = 'jorge.tapia@despacho.mx'; // contador en FDB, revisor en Cuautla
const FERRETERIA = 'FDB190215QK4';
const DOMINIO = 'usuarios-listar.test';

interface Persona {
  id: string;
  email: string;
  nombre: string | null;
  roles: Rol[];
  estado: 'activo' | 'pendiente';
  invitacionId: string | null;
  vencida: boolean;
  venceEn: string | null;
  creadaEn: string | null;
  invitadaPor: string | null;
}

let app: INestApplication<App>;
let ds: DataSource;
let empresaId: string;
let otraEmpresaId: string;
let anaId: string;
let cookieAna: string;
let contador = 0;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  anaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM users WHERE email = $1', [
      ANA,
    ])
  ).id;
  empresaId = (
    await una<{ id: string }>(ds, 'SELECT id FROM companies WHERE rfc = $1', [
      FERRETERIA,
    ])
  ).id;
  otraEmpresaId = (
    await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ('LST010101AB1', 'Lista Ajena SA')
       ON CONFLICT (rfc) DO UPDATE SET razon_social = 'Lista Ajena SA'
       RETURNING id`,
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
      UsuariosModule,
    ],
  }).compile();
  app = modulo.createNestApplication();
  configurarApp(app);
  await app.listen(0);
  cookieAna = await abrirSesion(ds, anaId, empresaId);
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    await ds.query(
      `DELETE FROM sesiones WHERE user_id = $1 OR user_id IN
         (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
      [anaId],
    );
    await ds.query(
      `DELETE FROM bitacora WHERE accion = 'acceso_denegado' AND user_id IN
         (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(`DELETE FROM invitaciones WHERE company_id = ANY($1)`, [
      [empresaId, otraEmpresaId],
    ]);
    await ds.query(
      `DELETE FROM user_company_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@${DOMINIO}')`,
    );
    await ds.query(`DELETE FROM users WHERE email LIKE '%@${DOMINIO}'`);
    await ds.query(`DELETE FROM companies WHERE id = $1`, [otraEmpresaId]);
    await ds.destroy();
  }
});

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
});

afterEach(() => jest.restoreAllMocks());

const http = () => request(app.getHttpServer());

function correoNuevo(prefijo: string): string {
  contador += 1;
  return `${prefijo}${contador}@${DOMINIO}`;
}

async function crearUsuario(
  email: string,
  nombre: string,
  roles: Array<{ companyId: string; rol: Rol }>,
  activo = true,
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO users (email, nombre, password_hash, activo)
     VALUES ($1, $2, 'no-sirve', $3) RETURNING id`,
    [email, nombre, activo],
  );
  for (const r of roles) {
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol) VALUES ($1, $2, $3)`,
      [id, r.companyId, r.rol],
    );
  }
  return id;
}

async function invitacion(
  email: string,
  roles: Rol[],
  opciones: { vencida?: boolean; companyId?: string } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO invitaciones
       (company_id, email, roles, token_hash, expires_at, invitada_por_user_id)
     VALUES ($1, $2, $3, $4, ${opciones.vencida ? "now() - interval '1 day'" : "now() + interval '7 days'"}, $5)
     RETURNING id`,
    [
      opciones.companyId ?? empresaId,
      email,
      roles,
      huellaDeToken(`${email}-${contador++}`),
      anaId,
    ],
  );
  return id;
}

async function lista(cookie: string = cookieAna): Promise<Persona[]> {
  const res = await http().get('/usuarios').set('Cookie', cookie).expect(200);
  return res.body as Persona[];
}

const delDominio = (personas: Persona[]) =>
  personas.filter((p) => p.email.endsWith(`@${DOMINIO}`));

describe('GET /usuarios', () => {
  it('lista solo los roles de esta empresa y nunca los de otra', async () => {
    const lectorId = await crearUsuario(correoNuevo('multi'), 'Multi Empresa', [
      { companyId: empresaId, rol: 'revisor' },
      { companyId: otraEmpresaId, rol: 'admin' },
    ]);
    const soloAjenoId = await crearUsuario(correoNuevo('ajeno'), 'Solo Ajeno', [
      { companyId: otraEmpresaId, rol: 'contador' },
    ]);

    const personas = await lista();

    const multi = personas.find((p) => p.id === lectorId);
    expect(multi).toMatchObject({
      nombre: 'Multi Empresa',
      roles: ['revisor'],
      estado: 'activo',
      invitacionId: null,
    });
    expect(personas.find((p) => p.id === soloAjenoId)).toBeUndefined();
    // Jorge: contador aquí y revisor en la otra empresa sembrada.
    expect(personas.find((p) => p.email === JORGE)?.roles).toEqual([
      'contador',
    ]);
  });

  it.each(['contador', 'revisor', 'auditor'] as const)(
    '%s recibe 403 y no ve la lista',
    async (rol) => {
      const email = correoNuevo(rol);
      const id = await crearUsuario(email, `Persona ${rol}`, [
        { companyId: empresaId, rol },
      ]);
      const cookie = await abrirSesion(ds, id, empresaId);

      await http().get('/usuarios').set('Cookie', cookie).expect(403);
    },
  );

  it('sin sesión responde 401', async () => {
    await http().get('/usuarios').expect(401);
  });

  it('distingue la invitación vigente de la vencida y trae sus datos', async () => {
    const vigente = correoNuevo('vigente');
    const vencida = correoNuevo('vencida');
    const vigenteId = await invitacion(vigente, ['contador', 'revisor']);
    const vencidaId = await invitacion(vencida, ['auditor'], { vencida: true });

    const personas = delDominio(await lista());

    expect(personas.find((p) => p.email === vigente)).toMatchObject({
      id: vigenteId,
      invitacionId: vigenteId,
      nombre: null,
      roles: ['contador', 'revisor'],
      estado: 'pendiente',
      vencida: false,
      invitadaPor: 'Ana Reyes',
      venceEn: expect.any(String) as string,
      creadaEn: expect.any(String) as string,
    });
    expect(personas.find((p) => p.email === vencida)).toMatchObject({
      invitacionId: vencidaId,
      estado: 'pendiente',
      vencida: true,
    });
  });

  it('no lista invitaciones aceptadas, reemplazadas, canceladas ni de otra empresa', async () => {
    const consumida = correoNuevo('consumida');
    const reemplazada = correoNuevo('reemplazada');
    const cancelada = correoNuevo('cancelada');
    const ajena = correoNuevo('invajena');
    const ids = [
      await invitacion(consumida, ['revisor']),
      await invitacion(reemplazada, ['revisor']),
      await invitacion(cancelada, ['revisor']),
    ];
    await ds.query(
      `UPDATE invitaciones SET consumida_en = now() WHERE id = $1`,
      [ids[0]],
    );
    await ds.query(
      `UPDATE invitaciones SET reemplazada_en = now() WHERE id = $1`,
      [ids[1]],
    );
    await ds.query(
      `UPDATE invitaciones SET cancelada_en = now() WHERE id = $1`,
      [ids[2]],
    );
    await invitacion(ajena, ['revisor'], { companyId: otraEmpresaId });

    const correos = (await lista()).map((p) => p.email);

    for (const email of [consumida, reemplazada, cancelada, ajena]) {
      expect(correos).not.toContain(email);
    }
  });

  it('mezcla activos y pendientes en una fila por persona, ordenados por correo', async () => {
    const activo = correoNuevo('mmm-activo');
    const pendiente = correoNuevo('aaa-pendiente');
    const ultimo = correoNuevo('zzz-activo');
    await crearUsuario(activo, 'Activo M', [
      { companyId: empresaId, rol: 'contador' },
    ]);
    await crearUsuario(ultimo, 'Activo Z', [
      { companyId: empresaId, rol: 'auditor' },
    ]);
    await invitacion(pendiente, ['revisor']);

    const personas = await lista();
    const correos = personas.map((p) => p.email);

    expect(correos).toEqual([...correos].sort());
    expect(new Set(correos).size).toBe(correos.length);
    const propios = delDominio(personas).filter((p) =>
      [activo, pendiente, ultimo].includes(p.email),
    );
    expect(propios.map((p) => [p.email, p.estado])).toEqual([
      [pendiente, 'pendiente'],
      [activo, 'activo'],
      [ultimo, 'activo'],
    ]);
  });

  it('una persona activa con invitación abierta sale una sola vez, como activa', async () => {
    const email = correoNuevo('doble');
    const id = await crearUsuario(email, 'Persona Doble', [
      { companyId: empresaId, rol: 'contador' },
    ]);
    await invitacion(email, ['revisor']);

    const filas = (await lista()).filter((p) => p.email === email);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      id,
      estado: 'activo',
      roles: ['contador'],
      invitacionId: null,
    });
  });

  it('no lista a quien tiene la cuenta desactivada', async () => {
    const email = correoNuevo('inactivo');
    await crearUsuario(
      email,
      'Inactivo',
      [{ companyId: empresaId, rol: 'contador' }],
      false,
    );

    expect((await lista()).map((p) => p.email)).not.toContain(email);
  });
});
