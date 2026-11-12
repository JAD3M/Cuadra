import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from './testing/app-de-cargas';

/**
 * Historia 8.2: POST /cargas/estado-cuenta/pdf con banco Santander, con y sin
 * contraseña. SINTÉTICO [SUPUESTO]: los PDF son los fixtures de la historia
 * (el protegido se abre con `clave-prueba`), no estados de cuenta reales.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

async function limpiar(): Promise<void> {
  await ds.query(`DELETE FROM movimientos_pendientes`);
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas'
        AND accion IN ('cargar', 'rechazar')`,
  );
  await ds.query(
    `DELETE FROM cargas WHERE estado IN ('pendiente_vista_previa', 'rechazada')`,
  );
}

beforeEach(async () => {
  await limpiar();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const fixture = (nombre: string) =>
  readFileSync(join(__dirname, '..', 'bancos', 'fixtures', nombre));
const ABIERTO = fixture('santander-sintetico.pdf');
const PROTEGIDO = fixture('santander-protegido-sintetico.pdf');
const CLAVE = 'clave-prueba';

function subir(
  token: string,
  nombre: string,
  contenido: Buffer,
  contrasena?: string,
) {
  let req = request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', token)
    .field('banco', 'santander');
  if (contrasena !== undefined) req = req.field('contrasena', contrasena);
  return req.attach('archivo', contenido, nombre);
}

const luis = () => entorno.token(LUIS, FERRETERIA);

const cuerpo = (res: { body: unknown }) =>
  res.body as { message: string; error?: string };

const totalCargas = () =>
  una<{ n: number }>(ds, `SELECT count(*)::int AS n FROM cargas`);

/** Todo lo que el flujo pudo dejar en la base, como un solo texto. */
async function volcado(): Promise<string> {
  const partes = await Promise.all([
    ds.query<Array<{ j: string }>>(
      `SELECT row_to_json(c)::text AS j FROM cargas c`,
    ),
    ds.query<Array<{ j: string }>>(
      `SELECT row_to_json(b)::text AS j FROM bitacora b`,
    ),
    ds.query<Array<{ j: string }>>(
      `SELECT row_to_json(m)::text AS j FROM movimientos_pendientes m`,
    ),
  ]);
  return partes
    .flat()
    .map((f) => f.j)
    .join('\n');
}

describe('POST /cargas/estado-cuenta/pdf con Santander (historia 8.2)', () => {
  it('un PDF sin protección cuadra y no pide contraseña', async () => {
    const res = await subir(await luis(), 'santander.pdf', ABIERTO).expect(200);
    expect(res.body).toMatchObject({
      banco: 'santander',
      saldoInicial: '10000.00',
      saldoFinal: '11250.50',
      movimientosLeidos: 2,
      estado: 'pendiente_vista_previa',
    });
  });

  it('un PDF sin protección ignora una contraseña que sobre', async () => {
    await subir(await luis(), 'santander.pdf', ABIERTO, 'sobra').expect(200);
  });

  it('un PDF protegido sin contraseña: pide la contraseña y no crea nada', async () => {
    const res = await subir(await luis(), 'protegido.pdf', PROTEGIDO).expect(
      400,
    );
    expect(cuerpo(res).error).toBe('pdf_requiere_contrasena');
    expect(cuerpo(res).message).toMatch(/contraseña/);
    expect((await totalCargas()).n).toBe(0);
  });

  it('un PDF protegido con la contraseña correcta cuadra y queda en espera', async () => {
    const res = await subir(
      await luis(),
      'protegido.pdf',
      PROTEGIDO,
      CLAVE,
    ).expect(200);
    expect(res.body).toMatchObject({
      banco: 'santander',
      saldoInicial: '10000.00',
      saldoFinal: '11250.50',
      estado: 'pendiente_vista_previa',
    });
  });

  it('una contraseña incorrecta: mensaje claro, sin carga y con bitácora del motivo', async () => {
    const res = await subir(
      await luis(),
      'protegido.pdf',
      PROTEGIDO,
      'mala-secreta-123',
    ).expect(400);
    expect(cuerpo(res).error).toBe('pdf_contrasena_incorrecta');
    expect(cuerpo(res).message).toMatch(/no es correcta/);
    expect((await totalCargas()).n).toBe(0);
    const rechazo = await una<{ datos: { motivo: string } }>(
      ds,
      `SELECT datos FROM bitacora
        WHERE entidad = 'cargas' AND accion = 'rechazar'`,
    );
    expect(rechazo.datos.motivo).toBe('pdf_contrasena_incorrecta');
  });

  it('la contraseña no aparece en la respuesta, la base ni los registros', async () => {
    const secreta = 'clave-que-no-debe-verse-777';
    const registros = [
      jest.spyOn(Logger.prototype, 'log'),
      jest.spyOn(Logger.prototype, 'warn'),
      jest.spyOn(Logger.prototype, 'error'),
      jest.spyOn(Logger.prototype, 'debug'),
      jest.spyOn(Logger.prototype, 'verbose'),
      jest.spyOn(console, 'log'),
      jest.spyOn(console, 'error'),
    ];
    const mala = await subir(
      await luis(),
      'protegido.pdf',
      PROTEGIDO,
      secreta,
    ).expect(400);
    const buena = await subir(
      await luis(),
      'protegido.pdf',
      PROTEGIDO,
      CLAVE,
    ).expect(200);
    const respuestas = JSON.stringify([mala.body, buena.body]);
    expect(respuestas).not.toContain(secreta);
    expect(respuestas).not.toContain(CLAVE);
    const base = await volcado();
    expect(base).not.toContain(secreta);
    expect(base).not.toContain(CLAVE);
    const escrito = JSON.stringify(registros.flatMap((s) => s.mock.calls));
    expect(escrito).not.toContain(secreta);
    expect(escrito).not.toContain(CLAVE);
  });

  it('una contraseña de más de 128 caracteres se rechaza', async () => {
    await subir(
      await luis(),
      'protegido.pdf',
      PROTEGIDO,
      'x'.repeat(129),
    ).expect(400);
    expect((await totalCargas()).n).toBe(0);
  });
});
