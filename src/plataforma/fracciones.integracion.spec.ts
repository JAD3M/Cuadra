import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { PasswordHasher } from '../auth/password';
import { validateEnv } from '../config/env.validation';
import { configurarApp } from '../configurar-app';
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
import { abrirSesion, cookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';

const PREFIJO_LIMITE = 'cuadra_test_fracciones';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 6.3 (FR-69): el dueño ve las fracciones de PPD, parcialidades y comisiones por empresa.
 * Postgres y Redis reales; la app corre como cuadra_app.
 */

const CORREO_DUENO = 'dueno-fracciones@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const ANA = 'ana.reyes@fdb.mx';
const FERRETERIA = 'FDB190215QK4';
const RFC_A = 'FRC010101AAA';
const RFC_B = 'FRC020202BBB';

let app: INestApplication<App>;
let ds: DataSource;
let anaId: string;
let ferreteriaId: string;
let empresaA: string;
let empresaB: string;
let linea = 0;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);

  const hashPw = await new PasswordHasher().hashear(PASSWORD_DUENO);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hashPw],
  );
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
  for (const rfc of [RFC_A, RFC_B]) {
    const { id } = await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ($1, 'Empresa 6.3')
       RETURNING id`,
      [rfc],
    );
    if (rfc === RFC_A) empresaA = id;
    else empresaB = id;
  }

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
}, 60_000);

afterAll(async () => {
  if (app) await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await app?.close();
  if (ds?.isInitialized) {
    await limpiar();
    await ds.query(
      'DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL',
    );
    await ds.query('DELETE FROM bitacora_plataforma');
    await ds.query('DELETE FROM plataforma_usuarios WHERE correo = $1', [
      CORREO_DUENO,
    ]);
    await ds.query('DELETE FROM companies WHERE rfc = ANY($1)', [
      [RFC_A, RFC_B],
    ]);
    await ds.destroy();
  }
});

async function limpiar(): Promise<void> {
  await ds.query('DELETE FROM movimientos WHERE company_id = ANY($1)', [
    [empresaA, empresaB],
  ]);
  await ds.query('DELETE FROM cfdi WHERE company_id = ANY($1)', [
    [empresaA, empresaB],
  ]);
}

beforeEach(async () => {
  await limpiarLimites(app.get<Redis>(CLIENTE_REDIS), PREFIJO_LIMITE);
  await limpiar();
});

const http = () => request(app.getHttpServer());

async function loginDueno(): Promise<string> {
  const res = await http()
    .post('/plataforma/auth/login')
    .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
    .expect(200);
  return cookieDe(res);
}

async function factura(empresa: string, metodoPago: 'PUE' | 'PPD' | null) {
  await ds.query(
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total,
                       metodo_pago, estado, xml_raw)
     VALUES ($1,$2,'AAA010101AAA','XAXX010101000','A','1','2026-09-01T10:00:00','I','MXN',
             '100.00','116.00',$3,'abierta','{"_xml":"<x/>"}'::jsonb)`,
    [empresa, randomUUID(), metodoPago],
  );
}

async function movimiento(
  empresa: string,
  clase: 'comision' | 'parcialidad' | null,
) {
  linea += 1;
  await ds.query(
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, moneda, clase)
     VALUES ($1,$2,'2026-09-02','MOVIMIENTO','10.00','MXN',$3)`,
    [empresa, linea, clase],
  );
}

interface FraccionesDto {
  companyId: string;
  razonSocial: string;
  facturas: { total: number; ppd: number };
  movimientos: { total: number; parcialidades: number; comisiones: number };
  fraccionPpd: string | null;
  fraccionParcialidades: string | null;
  fraccionComisiones: string | null;
}

async function consultar(cookie: string): Promise<FraccionesDto[]> {
  const res = await http()
    .get('/plataforma/fracciones')
    .set('Cookie', cookie)
    .expect(200);
  return res.body as FraccionesDto[];
}

describe('GET /plataforma/fracciones (6.3)', () => {
  it('calcula las tres fracciones por empresa, sin mezclar las de otra', async () => {
    const cookie = await loginDueno();
    for (const metodo of ['PPD', 'PUE', 'PUE', null] as const) {
      await factura(empresaA, metodo);
    }
    await factura(empresaB, 'PPD');
    for (const clase of [
      'parcialidad',
      'comision',
      'comision',
      null,
      null,
      null,
      null,
      null,
    ] as const) {
      await movimiento(empresaA, clase);
    }
    await movimiento(empresaB, 'parcialidad');

    const lista = await consultar(cookie);

    expect(lista.find((e) => e.companyId === empresaA)).toMatchObject({
      facturas: { total: 4, ppd: 1 },
      movimientos: { total: 8, parcialidades: 1, comisiones: 2 },
      fraccionPpd: '0.2500',
      fraccionParcialidades: '0.1250',
      fraccionComisiones: '0.2500',
    });
    expect(lista.find((e) => e.companyId === empresaB)).toMatchObject({
      facturas: { total: 1, ppd: 1 },
      movimientos: { total: 1, parcialidades: 1, comisiones: 0 },
      fraccionPpd: '1.0000',
      fraccionParcialidades: '1.0000',
      fraccionComisiones: '0.0000',
    });
  });

  it('una empresa sin facturas ni movimientos da null, no cero ni error', async () => {
    const lista = await consultar(await loginDueno());
    expect(lista.find((e) => e.companyId === empresaA)).toMatchObject({
      facturas: { total: 0, ppd: 0 },
      movimientos: { total: 0, parcialidades: 0, comisiones: 0 },
      fraccionPpd: null,
      fraccionParcialidades: null,
      fraccionComisiones: null,
    });
  });

  it('se calcula por consulta: un movimiento nuevo cambia la siguiente respuesta', async () => {
    const cookie = await loginDueno();
    await movimiento(empresaA, null);
    expect(
      (await consultar(cookie)).find((e) => e.companyId === empresaA),
    ).toMatchObject({ fraccionComisiones: '0.0000' });

    await movimiento(empresaA, 'comision');

    expect(
      (await consultar(cookie)).find((e) => e.companyId === empresaA),
    ).toMatchObject({ fraccionComisiones: '0.5000' });
  });

  it('no guarda nada: ninguna tabla de plataforma se escribe al consultar', async () => {
    const cookie = await loginDueno();
    const antes = await una<{ n: string }>(
      ds,
      'SELECT count(*) AS n FROM bitacora_plataforma',
    );
    await consultar(cookie);
    const despues = await una<{ n: string }>(
      ds,
      'SELECT count(*) AS n FROM bitacora_plataforma',
    );
    expect(despues.n).toBe(antes.n);
  });

  it('sin sesión da 401 y una sesión de empresa (aunque sea de la misma) da 403', async () => {
    await http().get('/plataforma/fracciones').expect(401);
    const cookie = await abrirSesion(ds, anaId, ferreteriaId);
    await http()
      .get('/plataforma/fracciones')
      .set('Cookie', cookie)
      .expect(403);
  });
});
