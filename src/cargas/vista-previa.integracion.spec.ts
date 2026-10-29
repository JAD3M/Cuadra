import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { filas, una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from './testing/app-de-cargas';

/**
 * Historia 3.4: vista previa de un PDF en espera, y aceptarlo o rechazarlo.
 * SINTÉTICO: el PDF de BBVA es el fixture de la historia, no un estado de
 * cuenta real. Contra Postgres real y la app completa (RLS activo).
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

/**
 * La base de pruebas se comparte y la prueba de reversibilidad de migraciones
 * falla si quedan cargas 'rechazada' o 'pendiente_vista_previa': cada prueba
 * parte de cero y la suite deja todo limpio. El dueño borra sin RLS.
 */
async function limpiar(): Promise<void> {
  const propias = `(SELECT id FROM cargas WHERE tipo = 'estado_cuenta'
                     AND nombre_archivo LIKE 'vp-%')`;
  await ds.query(
    `DELETE FROM conciliaciones WHERE movimiento_id IN
       (SELECT id FROM movimientos WHERE carga_id IN ${propias})`,
  );
  await ds.query(`DELETE FROM movimientos WHERE carga_id IN ${propias}`);
  await ds.query(
    `DELETE FROM movimientos_pendientes WHERE carga_id IN ${propias}`,
  );
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas'
        AND (entidad_id IN ${propias} OR entidad_id IS NULL)`,
  );
  await ds.query(
    `DELETE FROM cargas WHERE tipo = 'estado_cuenta' AND nombre_archivo LIKE 'vp-%'`,
  );
}

beforeEach(async () => {
  await limpiar();
});

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const BBVA = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);

/** Sube el PDF sintético y devuelve la carga que quedó en espera. */
async function subirPdf(correo: string, rfc: string): Promise<string> {
  const res = await request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', await entorno.token(correo, rfc))
    .field('banco', 'bbva')
    .attach('archivo', BBVA, 'vp-bbva.pdf')
    .expect(200);
  return (res.body as { cargaId: string }).cargaId;
}

async function llamar(
  metodo: 'get' | 'post',
  ruta: string,
  correo: string | null,
  esperado: number,
  rfc: string = FERRETERIA,
) {
  let req = request(entorno.app.getHttpServer())[metodo](ruta);
  if (correo) req = req.set('Cookie', await entorno.token(correo, rfc));
  return req.expect(esperado);
}

describe('GET /cargas/:id/vista-previa (T2)', () => {
  it('trae los movimientos leídos, el total y los saldos, exactos', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    const res = await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      LUIS,
      200,
    );
    expect(res.body).toEqual({
      cargaId,
      archivo: 'vp-bbva.pdf',
      banco: 'bbva',
      total: 2,
      saldoInicial: '10000.0000',
      saldoFinal: '11250.5000',
      movimientos: [
        { fecha: '2026-10-02', monto: '-250.0000', referencia: null },
        { fecha: '2026-10-15', monto: '1500.5000', referencia: 'SINT-0001' },
      ],
    });
  });

  it('un admin también la ve', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, ANA, 200);
  });

  it('una carga que no está en espera: 404', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await ds.query(`UPDATE cargas SET estado = 'rechazada' WHERE id = $1`, [
      cargaId,
    ]);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, LUIS, 404);
  });

  it('una carga que no es de PDF o no existe: 404', async () => {
    await llamar(
      'get',
      '/cargas/0198f3a0-0000-7000-8000-000000000000/vista-previa',
      LUIS,
      404,
    );
  });

  it('la carga de otra empresa: 404, igual que una inexistente', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      CARMEN,
      404,
      TRANSPORTES,
    );
  });

  it('un id que no es uuid: 400', async () => {
    await llamar('get', '/cargas/xyz/vista-previa', LUIS, 400);
  });

  it('sin sesión: 401; revisor: 403', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, null, 401);
    await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      JORGE,
      403,
      TRANSPORTES,
    );
  });

  it('no escribe nada: la espera queda intacta', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, LUIS, 200);
    expect(
      await filas(
        ds,
        `SELECT 1 FROM movimientos_pendientes WHERE carga_id = $1`,
        [cargaId],
      ),
    ).toHaveLength(2);
    expect(
      await una<{ estado: string }>(
        ds,
        `SELECT estado FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toEqual({ estado: 'pendiente_vista_previa' });
  });
});
