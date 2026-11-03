import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
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
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { CLIENTE_REDIS } from '../redis/cliente-redis';
import { limpiarLimites } from '../testing/limites-de-pruebas';
import { abrirSesion, cookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  BancosVistaPrevia,
  MINIMO_CARGAS_ACEPTADAS,
} from './bancos-vista-previa.service';

const PREFIJO_LIMITE = 'cuadra_test_bancos_vp';
process.env.COLA_PREFIJO = PREFIJO_LIMITE;

/**
 * Historia 3.6, T2: el dueño consulta y levanta la vista previa de un banco.
 * Postgres y Redis reales; la app corre como cuadra_app.
 */

const CORREO_DUENO = 'dueno-bancos@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const ANA = 'ana.reyes@fdb.mx';
const FERRETERIA = 'FDB190215QK4';
const RFC_A = 'BVT010101AAA';
const RFC_B = 'BVT020202BBB';
const BANCO = 'bbva';

let app: INestApplication<App>;
let ds: DataSource;
let duenoId: string;
let anaId: string;
let ferreteriaId: string;
let empresaA: string;
let empresaB: string;
let contador = 0;

function hash(texto: string): string {
  return createHash('sha256').update(texto).digest('hex');
}

async function sembrarCarga(
  companyId: string,
  estado: string,
  banco = BANCO,
): Promise<void> {
  contador += 1;
  await ds.query(
    `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo, hash_archivo,
                         banco, saldo_inicial, saldo_final)
     VALUES ($1, 'estado_cuenta', $2, $3, $4, $5, '0.0000', '0.0000')`,
    [companyId, estado, `c${contador}.pdf`, hash(`c${contador}`), banco],
  );
}

async function sembrarAceptadas(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await sembrarCarga(i % 2 === 0 ? empresaA : empresaB, 'procesada');
  }
}

async function escrituras(): Promise<{ filas: number; bitacora: number }> {
  return {
    filas: Number(
      (
        await una<{ n: string }>(
          ds,
          'SELECT count(*) AS n FROM bancos_vista_previa',
        )
      ).n,
    ),
    bitacora: Number(
      (
        await una<{ n: string }>(
          ds,
          `SELECT count(*) AS n FROM bitacora_plataforma WHERE accion = 'levantar_vista_previa'`,
        )
      ).n,
    ),
  };
}

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
  for (const rfc of [RFC_A, RFC_B]) {
    const { id } = await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ($1, 'Empresa 3.6 T2')
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
  await ds.query('DELETE FROM bancos_vista_previa');
  await ds.query('DELETE FROM cargas WHERE company_id = ANY($1)', [
    [empresaA, empresaB],
  ]);
  await ds.query(
    `DELETE FROM bitacora_plataforma WHERE accion = 'levantar_vista_previa'`,
  );
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

interface BancoDto {
  banco: string;
  aceptadas: number;
  minimoAceptadas: number;
  levantada: boolean;
  levantadaEn: string | null;
}

describe('GET /plataforma/bancos', () => {
  it('cuenta por consulta, entre empresas, y solo las aceptadas', async () => {
    const cookie = await loginDueno();
    await sembrarCarga(empresaA, 'procesada');
    await sembrarCarga(empresaB, 'procesada');
    await sembrarCarga(empresaA, 'rechazada');
    await sembrarCarga(empresaB, 'pendiente_vista_previa');
    await sembrarCarga(empresaB, 'fallida');

    const res = await http()
      .get('/plataforma/bancos')
      .set('Cookie', cookie)
      .expect(200);
    const lista = res.body as BancoDto[];
    expect(lista.find((b) => b.banco === BANCO)).toEqual({
      banco: BANCO,
      aceptadas: 2,
      minimoAceptadas: MINIMO_CARGAS_ACEPTADAS,
      levantada: false,
      levantadaEn: null,
    });

    // Sin contador guardado: otra carga aceptada se ve en la siguiente consulta.
    await sembrarCarga(empresaA, 'procesada');
    const otra = await http().get('/plataforma/bancos').set('Cookie', cookie);
    expect((otra.body as BancoDto[]).find((b) => b.banco === BANCO)).toEqual(
      expect.objectContaining({ aceptadas: 3 }),
    );
  });

  it('un banco sin cargas aparece con 0', async () => {
    const cookie = await loginDueno();
    const res = await http()
      .get('/plataforma/bancos')
      .set('Cookie', cookie)
      .expect(200);
    expect((res.body as BancoDto[]).find((b) => b.banco === BANCO)).toEqual(
      expect.objectContaining({ aceptadas: 0, levantada: false }),
    );
  });

  it('sin sesión da 401 y una sesión de empresa da 403', async () => {
    await http().get('/plataforma/bancos').expect(401);
    const cookie = await abrirSesion(ds, anaId, ferreteriaId);
    await http().get('/plataforma/bancos').set('Cookie', cookie).expect(403);
  });
});

describe('POST /plataforma/bancos/:banco/levantar-vista-previa', () => {
  const levantar = (cookie: string, banco = BANCO) =>
    http()
      .post(`/plataforma/bancos/${banco}/levantar-vista-previa`)
      .set('Cookie', cookie);

  it('con menos de cinco aceptadas rechaza con mensaje claro y no escribe nada', async () => {
    const cookie = await loginDueno();
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS - 1);
    // Las rechazadas no suman.
    await sembrarCarga(empresaA, 'rechazada');

    const res = await levantar(cookie).expect(422);
    const mensaje = (res.body as { message: string }).message;
    expect(mensaje).toContain('4');
    expect(mensaje).toContain(String(MINIMO_CARGAS_ACEPTADAS));
    expect(await escrituras()).toEqual({ filas: 0, bitacora: 0 });
  });

  it('con cinco aceptadas levanta: fila con quién y cuándo, y bitácora', async () => {
    const cookie = await loginDueno();
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);

    const res = await levantar(cookie, `  ${BANCO.toUpperCase()} `).expect(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        banco: BANCO,
        aceptadas: MINIMO_CARGAS_ACEPTADAS,
        minimoAceptadas: MINIMO_CARGAS_ACEPTADAS,
        levantada: true,
      }),
    );

    const fila = await una<{ levantada_por: string; levantada_en: Date }>(
      ds,
      'SELECT levantada_por, levantada_en FROM bancos_vista_previa WHERE banco = $1',
      [BANCO],
    );
    expect(fila.levantada_por).toBe(duenoId);
    expect(fila.levantada_en).toBeInstanceOf(Date);
    const rastro = await filas<{
      plataforma_usuario_id: string;
      detalle: unknown;
    }>(
      ds,
      `SELECT plataforma_usuario_id, detalle FROM bitacora_plataforma
        WHERE accion = 'levantar_vista_previa'`,
    );
    expect(rastro).toHaveLength(1);
    expect(rastro[0].plataforma_usuario_id).toBe(duenoId);
    expect(rastro[0].detalle).toEqual({
      banco: BANCO,
      aceptadas: MINIMO_CARGAS_ACEPTADAS,
    });

    const lista = await http()
      .get('/plataforma/bancos')
      .set('Cookie', cookie)
      .expect(200);
    expect((lista.body as BancoDto[]).find((b) => b.banco === BANCO)).toEqual(
      expect.objectContaining({ levantada: true }),
    );
  });

  it('levantar otra vez da 409 y no duplica nada', async () => {
    const cookie = await loginDueno();
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);
    await levantar(cookie).expect(201);
    const res = await levantar(cookie).expect(409);
    expect((res.body as { message: string }).message).toMatch(/ya está/i);
    expect(await escrituras()).toEqual({ filas: 1, bitacora: 1 });
  });

  it('un banco sin lector de PDF da 404', async () => {
    const cookie = await loginDueno();
    await levantar(cookie, 'banco_que_no_existe').expect(404);
    expect(await escrituras()).toEqual({ filas: 0, bitacora: 0 });
  });

  it('dos peticiones a la vez: una levanta, la otra 409, ninguna 500', async () => {
    const cookie = await loginDueno();
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);
    const respuestas = await Promise.all([
      levantar(cookie),
      levantar(cookie),
      levantar(cookie),
    ]);
    const codigos = respuestas.map((r) => r.status).sort();
    expect(codigos).toEqual([201, 409, 409]);
    expect(await escrituras()).toEqual({ filas: 1, bitacora: 1 });
  });

  it('sin sesión da 401 y una sesión de empresa da 403 sin escribir', async () => {
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);
    await http()
      .post(`/plataforma/bancos/${BANCO}/levantar-vista-previa`)
      .expect(401);
    const cookie = await abrirSesion(ds, anaId, ferreteriaId);
    await levantar(cookie).expect(403);
    expect(await escrituras()).toEqual({ filas: 0, bitacora: 0 });
  });
});

describe('BancosVistaPrevia.estaLevantado', () => {
  it('es falso antes de levantar y verdadero después, con el banco normalizado', async () => {
    const servicio = app.get(BancosVistaPrevia, { strict: false });
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);
    expect(await servicio.estaLevantado(BANCO)).toBe(false);

    await servicio.levantar(duenoId, BANCO);
    expect(await servicio.estaLevantado(BANCO)).toBe(true);
    expect(await servicio.estaLevantado('  BBVA ')).toBe(true);
    expect(await servicio.estaLevantado('otro')).toBe(false);
  });
});
