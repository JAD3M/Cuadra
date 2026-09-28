import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { request as peticionHttp } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import type { JwtPayload } from '../auth/tipos';
import { validateEnv } from '../config/env.validation';
import { ContextoEmpresaModule } from '../database/contexto-empresa.module';
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
import { CargasModule } from './cargas.module';
import {
  MAX_ARCHIVOS,
  MAX_BYTES_POR_ARCHIVO,
  MAX_BYTES_POR_PETICION,
} from './archivos-xml.guard';
import type { EstadoDeCarga } from './cargas.service';

/**
 * CU-06 de punta a punta: HTTP, guards globales, transacción de empresa como
 * cuadra_app (RLS activo) y Postgres real. XML sintéticos de CU-05.
 */

const ANA = 'ana.reyes@fdb.mx'; // admin en Ferretería
const LUIS = 'luis.mendoza@fdb.mx'; // contador en Ferretería
const CARMEN = 'carmen.olvera@cuautla.mx'; // admin en Transportes
const JORGE = 'jorge.tapia@despacho.mx'; // revisor en Transportes
const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';

let app: INestApplication<App>;
/** Dueño: limpia y verifica sin RLS. */
let ds: DataSource;
let jwt: JwtService;
const empresas = new Map<string, string>();
const personas = new Map<string, string>();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({
    ...opcionesDataSource,
    url,
  } as typeof opcionesDataSource).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  // cuadra_test sobrevive entre corridas: sin esto, los UUID de la corrida
  // anterior chocarían. Los otros specs recrean sus cargas en su beforeAll.
  await ds.query('TRUNCATE cfdi, cargas CASCADE');

  for (const rfc of [FERRETERIA, TRANSPORTES]) {
    const { id } = await una<{ id: string }>(
      ds,
      'SELECT id FROM companies WHERE rfc = $1',
      [rfc],
    );
    empresas.set(rfc, id);
  }
  for (const email of [ANA, LUIS, CARMEN, JORGE]) {
    const { id } = await una<{ id: string }>(
      ds,
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    personas.set(email, id);
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
      ContextoEmpresaModule,
      AuthModule,
      CargasModule,
    ],
  }).compile();

  app = modulo.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0);
  jwt = new JwtService({
    secret: app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
  if (ds?.isInitialized) {
    // También al salir: un CFDI en 'parcialidades' detiene el down de
    // CargaDeArchivos, y esquema.spec revierte todas las migraciones.
    await ds.query('TRUNCATE cfdi, cargas CASCADE');
    await ds.destroy();
  }
});

function de(mapa: Map<string, string>, llave: string): string {
  const valor = mapa.get(llave);
  if (valor === undefined) throw new Error(`Falta "${llave}" en el beforeAll`);
  return valor;
}

function tokenSesion(email: string, rfc: string): Promise<string> {
  const payload: JwtPayload = {
    sub: de(personas, email),
    scope: 'sesion',
    companyId: de(empresas, rfc),
  };
  return jwt.signAsync(payload, { expiresIn: '15m' });
}

/**
 * Fixture de CU-05 con UUID nuevo: cada test es independiente de los demás
 * y de corridas anteriores.
 */
function cfdi(nombre: string, uuid = randomUUID().toUpperCase()) {
  const original = readFileSync(
    join(__dirname, '..', 'cfdi', 'fixtures', nombre),
    'utf8',
  );
  return {
    uuid,
    xml: original.replace(/UUID="[^"]+"/, `UUID="${uuid}"`),
  };
}

interface Archivo {
  nombre: string;
  contenido: string | Buffer;
}

function subir(token: string, archivos: Archivo[]) {
  let req = request(app.getHttpServer())
    .post('/cargas/cfdi')
    .auth(token, { type: 'bearer' });
  for (const { nombre, contenido } of archivos) {
    req = req.attach('archivos', Buffer.from(contenido), nombre);
  }
  return req;
}

async function conteos() {
  return una<{ cfdi: number; cargas: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cfdi) AS cfdi,
            (SELECT count(*)::int FROM cargas) AS cargas`,
  );
}

/**
 * Multipart a mano con Transfer-Encoding: chunked. Supertest siempre manda
 * Content-Length, así que el atajo del header se llevaría este caso y el
 * contador del almacenamiento quedaría sin probar.
 */
async function subirChunked(
  token: string,
  archivos: Archivo[],
): Promise<{ status: number; cuerpo: string }> {
  const frontera = `----cuadra${randomUUID()}`;
  const destino = new URL('/cargas/cfdi', await app.getUrl());
  return new Promise((resolve, reject) => {
    const req = peticionHttp(
      destino,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${frontera}`,
          'transfer-encoding': 'chunked',
        },
      },
      (res) => {
        let cuerpo = '';
        res.setEncoding('utf8');
        res.on('data', (parte: string) => (cuerpo += parte));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, cuerpo }));
      },
    );
    req.on('error', reject);
    for (const { nombre, contenido } of archivos) {
      req.write(
        `--${frontera}\r\nContent-Disposition: form-data; name="archivos"; filename="${nombre}"\r\nContent-Type: application/xml\r\n\r\n`,
      );
      req.write(contenido);
      req.write('\r\n');
    }
    req.end(`--${frontera}--\r\n`);
  });
}

function mensaje(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

async function enCfdi(uuids: string[]) {
  return filas<{ uuid_fiscal: string; estado: string; carga_id: string }>(
    ds,
    'SELECT uuid_fiscal, estado, carga_id FROM cfdi WHERE uuid_fiscal = ANY($1)',
    [uuids],
  );
}

describe('POST /cargas/cfdi (CU-06)', () => {
  it('lote de 3 con 1 inválido: 201, 2 entran y el fallo se reporta', async () => {
    const pue = cfdi('pue-valido.xml');
    const descuento = cfdi('con-descuento.xml');
    const malo = cfdi('rechazo-total-no-cuadra.xml');

    const res = await subir(await tokenSesion(LUIS, FERRETERIA), [
      { nombre: 'pue.xml', contenido: pue.xml },
      { nombre: 'malo.xml', contenido: malo.xml },
      { nombre: 'descuento.xml', contenido: descuento.xml },
    ]).expect(201);

    const carga = res.body as EstadoDeCarga;
    expect(carga).toMatchObject({
      estado: 'procesada',
      totalRegistros: 3,
      registrosOk: 2,
      registrosError: 1,
    });
    expect(carga.errores).toHaveLength(1);
    expect(carga.errores[0].archivo).toBe('malo.xml');
    expect(carga.errores[0].motivo).toMatch(/Total no cuadra/);

    const guardados = await enCfdi([pue.uuid, descuento.uuid, malo.uuid]);
    expect(guardados.map((c) => c.uuid_fiscal).sort()).toEqual(
      [pue.uuid, descuento.uuid].sort(),
    );
    expect(guardados.every((c) => c.carga_id === carga.id)).toBe(true);
  });

  // El que prueba el savepoint: el choque es de la base, no del parser, y sin
  // ROLLBACK TO SAVEPOINT aborta la transacción entera.
  it('un UUID que ya existe en la empresa falla solo, los demás entran', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    const previo = cfdi('pue-valido.xml');
    await subir(token, [
      { nombre: 'previo.xml', contenido: previo.xml },
    ]).expect(201);

    // Mismo UUID, otro contenido (otro folio): otro lote, otro hash.
    const repetido = previo.xml.replace('Folio="1001"', 'Folio="2001"');
    const usd = cfdi('usd-tipo-cambio.xml');
    const seis = cfdi('importe-6-decimales.xml');

    const res = await subir(token, [
      { nombre: 'usd.xml', contenido: usd.xml },
      { nombre: 'repetido.xml', contenido: repetido },
      { nombre: 'seis.xml', contenido: seis.xml },
    ]).expect(201);

    const carga = res.body as EstadoDeCarga;
    expect(carga).toMatchObject({ registrosOk: 2, registrosError: 1 });
    expect(carga.errores).toHaveLength(1);
    expect(carga.errores[0].archivo).toBe('repetido.xml');
    expect(carga.errores[0].motivo).toMatch(/ya existe/);
    const guardados = await enCfdi([usd.uuid, seis.uuid]);
    expect(guardados).toHaveLength(2);
    expect(guardados.every((c) => c.carga_id === carga.id)).toBe(true);
  });

  it('un PPD queda en parcialidades', async () => {
    const ppd = cfdi('ppd-valido.xml');
    await subir(await tokenSesion(ANA, FERRETERIA), [
      { nombre: 'ppd.xml', contenido: ppd.xml },
    ]).expect(201);

    expect(await enCfdi([ppd.uuid])).toEqual([
      expect.objectContaining({ estado: 'parcialidades' }),
    ]);
  });

  it('si fallan todos, la carga queda fallida', async () => {
    const res = await subir(await tokenSesion(ANA, FERRETERIA), [
      { nombre: 'v33.xml', contenido: cfdi('rechazo-version-33.xml').xml },
      { nombre: 'rfc.xml', contenido: cfdi('rechazo-rfc-invalido.xml').xml },
    ]).expect(201);

    expect(res.body).toMatchObject({
      estado: 'fallida',
      registrosOk: 0,
      registrosError: 2,
    });
  });

  it('el mismo lote dos veces, aun en otro orden: 409', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    const a = cfdi('pue-valido.xml');
    const b = cfdi('con-descuento.xml');

    await subir(token, [
      { nombre: 'a.xml', contenido: a.xml },
      { nombre: 'b.xml', contenido: b.xml },
    ]).expect(201);
    await subir(token, [
      { nombre: 'b.xml', contenido: b.xml },
      { nombre: 'a.xml', contenido: a.xml },
    ]).expect(409);
  });

  it('un error de base que no es del archivo aborta todo: 500 y cero filas', async () => {
    const antes = await conteos();
    const bueno = cfdi('pue-valido.xml');
    // Serie más larga que su columna (varchar 25): el lector la acepta y la
    // base la rechaza con 22001. No es un fallo del archivo que el cliente
    // pueda corregir con un motivo claro: es un error nuestro.
    const raro = cfdi('con-descuento.xml');
    raro.xml = raro.xml.replace('Serie="A"', `Serie="${'S'.repeat(30)}"`);

    await subir(await tokenSesion(ANA, FERRETERIA), [
      { nombre: 'bueno.xml', contenido: bueno.xml },
      { nombre: 'raro.xml', contenido: raro.xml },
    ]).expect(500);

    // Ni la fila de la carga ni el primer CFDI, que sí había entrado.
    expect(await conteos()).toEqual(antes);
    expect(await enCfdi([bueno.uuid, raro.uuid])).toEqual([]);
  });

  it('un revisor no sube: 403', async () => {
    await subir(await tokenSesion(JORGE, TRANSPORTES), [
      { nombre: 'pue.xml', contenido: cfdi('pue-valido.xml').xml },
    ]).expect(403);
  });

  describe('límites → 400 o 413 con motivo', () => {
    it('un archivo que no es .xml', async () => {
      const res = await subir(await tokenSesion(ANA, FERRETERIA), [
        { nombre: 'notas.txt', contenido: 'hola' },
      ]).expect(400);
      expect(mensaje(res)).toMatch(/\.xml/);
    });

    it(`un archivo de más de ${MAX_BYTES_POR_ARCHIVO} bytes`, async () => {
      const res = await subir(await tokenSesion(ANA, FERRETERIA), [
        {
          nombre: 'grande.xml',
          contenido: Buffer.alloc(MAX_BYTES_POR_ARCHIVO + 1, 'a'),
        },
      ]).expect(400);
      expect(mensaje(res)).toMatch(/MB/);
    });

    it(`más de ${MAX_ARCHIVOS} archivos`, async () => {
      const archivos = Array.from({ length: MAX_ARCHIVOS + 1 }, (_, i) => ({
        nombre: `f${i}.xml`,
        contenido: `<x>${i}</x>`,
      }));
      const res = await subir(
        await tokenSesion(ANA, FERRETERIA),
        archivos,
      ).expect(400);
      expect(mensaje(res)).toMatch(/Máximo 500/);
    });

    // 26 × (2 MB − 1): cada archivo cabe, la suma no.
    const archivosQueSumanDeMas = () =>
      Array.from(
        {
          length: Math.ceil(MAX_BYTES_POR_PETICION / MAX_BYTES_POR_ARCHIVO) + 1,
        },
        (_, i) => ({
          nombre: `f${i}.xml`,
          contenido: Buffer.alloc(MAX_BYTES_POR_ARCHIVO - 1, 'a'),
        }),
      );

    it('más de 50 MB en total, con Content-Length: 413', async () => {
      const res = await subir(
        await tokenSesion(ANA, FERRETERIA),
        archivosQueSumanDeMas(),
      ).expect(413);
      expect(mensaje(res)).toMatch(/50 MB/);
    });

    it('más de 50 MB en total, chunked y sin Content-Length: 413', async () => {
      const { status, cuerpo } = await subirChunked(
        await tokenSesion(ANA, FERRETERIA),
        archivosQueSumanDeMas(),
      );
      expect(status).toBe(413);
      expect(cuerpo).toMatch(/50 MB/);
    });

    it('sin archivos', async () => {
      const res = await request(app.getHttpServer())
        .post('/cargas/cfdi')
        .auth(await tokenSesion(ANA, FERRETERIA), { type: 'bearer' })
        .expect(400);
      expect(mensaje(res)).toMatch(/al menos un archivo/);
    });
  });
});

describe('GET /cargas/:id (CU-06)', () => {
  let cargaTransportes: string;

  beforeAll(async () => {
    const res = await subir(await tokenSesion(CARMEN, TRANSPORTES), [
      { nombre: 'transportes.xml', contenido: cfdi('pue-valido.xml').xml },
    ]).expect(201);
    cargaTransportes = (res.body as EstadoDeCarga).id;
  });

  it('su empresa ve estado, contadores y errores: 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cargas/${cargaTransportes}`)
      .auth(await tokenSesion(JORGE, TRANSPORTES), { type: 'bearer' })
      .expect(200);

    expect(res.body).toEqual({
      id: cargaTransportes,
      estado: 'procesada',
      totalRegistros: 1,
      registrosOk: 1,
      registrosError: 0,
      errores: [],
    });
  });

  // Pendiente de CU-04: ahora contra el endpoint real, que sí podría leer la query.
  it('companyId en la query se ignora: carga ajena sigue en 404, igual que inexistente', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    const ajena = await request(app.getHttpServer())
      .get(`/cargas/${cargaTransportes}`)
      .query({ companyId: de(empresas, TRANSPORTES) })
      .auth(token, { type: 'bearer' })
      .expect(404);
    const inexistente = await request(app.getHttpServer())
      .get(`/cargas/${randomUUID()}`)
      .auth(token, { type: 'bearer' })
      .expect(404);

    expect(ajena.body).toEqual(inexistente.body);
  });
});
