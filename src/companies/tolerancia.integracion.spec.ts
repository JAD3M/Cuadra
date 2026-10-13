import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  CARMEN,
  type AppDeCargas,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ENTIDADES_BITACORA } from '../common/entities/tipos';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * CU-12 por HTTP contra Postgres real con RLS: roles, validación, bitácora,
 * aislamiento y el efecto en la siguiente conciliación.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

beforeEach(limpiar);

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(`UPDATE companies SET tolerancia_monto = 0`);
  await ds.query(`DELETE FROM bitacora WHERE entidad = 'companies'`);
  await ds.query('TRUNCATE cfdi, cargas, movimientos, conciliaciones CASCADE');
}

const tolerancia = async (empresa: string) =>
  (
    await una<{ t: string }>(
      ds,
      `SELECT tolerancia_monto::text AS t FROM companies WHERE id = $1`,
      [empresa],
    )
  ).t;

const bitacora = (accion: string) =>
  filas<{
    company_id: string;
    user_id: string;
    entidad: string;
    entidad_id: string;
    datos: Record<string, unknown>;
  }>(
    ds,
    `SELECT company_id, user_id, entidad, entidad_id, datos
       FROM bitacora WHERE entidad = 'companies' AND accion = $1
      ORDER BY created_at, id`,
    [accion],
  );

async function get(email: string, rfc: string) {
  return request(entorno.app.getHttpServer())
    .get('/empresa/tolerancia')
    .set('Cookie', await entorno.token(email, rfc));
}

async function put(email: string, rfc: string, cuerpo: unknown) {
  return request(entorno.app.getHttpServer())
    .put('/empresa/tolerancia')
    .set('Cookie', await entorno.token(email, rfc))
    .send(cuerpo as object);
}

describe('GET /empresa/tolerancia', () => {
  it.each([
    ['admin', ANA, FERRETERIA],
    ['contador', LUIS, FERRETERIA],
    ['revisor', JORGE, TRANSPORTES],
  ])(
    '%s la lee: estricta por omisión, como texto',
    async (_rol, email, rfc) => {
      const res = await get(email, rfc).then((r) => r);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ toleranciaMonto: '0.0000' });
    },
  );

  it('sin token es 401', async () => {
    await request(entorno.app.getHttpServer())
      .get('/empresa/tolerancia')
      .expect(401);
  });

  it('devuelve la de la empresa de la sesión, no la de otra', async () => {
    await ds.query(
      `UPDATE companies SET tolerancia_monto = 7.5 WHERE id = $1`,
      [A],
    );
    expect((await get(ANA, FERRETERIA)).body).toEqual({
      toleranciaMonto: '7.5000',
    });
    expect((await get(CARMEN, TRANSPORTES)).body).toEqual({
      toleranciaMonto: '0.0000',
    });
  });
});

describe('PUT /empresa/tolerancia: permisos', () => {
  it.each([
    ['contador', LUIS, FERRETERIA],
    ['revisor', JORGE, TRANSPORTES],
  ])(
    '%s recibe 403, no cambia nada y queda acceso_denegado',
    async (_rol, email, rfc) => {
      const empresa = entorno.empresa(rfc);
      const res = await put(email, rfc, { toleranciaMonto: '10' });

      expect(res.status).toBe(403);
      expect(await tolerancia(empresa)).toBe('0.0000');
      expect(await bitacora('actualizar')).toEqual([]);
      const denegados = await bitacora('acceso_denegado');
      expect(denegados).toHaveLength(1);
      expect(denegados[0]).toMatchObject({
        company_id: empresa,
        user_id: entorno.persona(email),
      });
    },
  );

  it('sin token es 401', async () => {
    await request(entorno.app.getHttpServer())
      .put('/empresa/tolerancia')
      .send({ toleranciaMonto: '10' })
      .expect(401);
  });
});

describe('PUT /empresa/tolerancia: validación', () => {
  it.each([
    ['negativo', { toleranciaMonto: '-1' }],
    ['sobre el tope', { toleranciaMonto: '100.01' }],
    ['5 decimales', { toleranciaMonto: '1.23456' }],
    ['notación científica', { toleranciaMonto: '1e1' }],
    ['no decimal', { toleranciaMonto: 'diez' }],
    ['con espacio', { toleranciaMonto: ' 5' }],
    ['vacío', { toleranciaMonto: '' }],
    ['número JSON', { toleranciaMonto: 12.5 }],
    ['sin campo', {}],
    ['empresa en el cuerpo', { toleranciaMonto: '5', companyId: randomUUID() }],
  ])('%s: 400, sin cambio ni bitácora', async (_caso, cuerpo) => {
    const res = await put(ANA, FERRETERIA, cuerpo);

    expect(res.status).toBe(400);
    expect(await tolerancia(A)).toBe('0.0000');
    expect(await bitacora('actualizar')).toEqual([]);
  });

  it.each([
    ['0', '0.0000'],
    ['100', '100.0000'],
    ['100.0000', '100.0000'],
    ['12.5', '12.5000'],
    ['0.0001', '0.0001'],
  ])('acepta %s y responde %s', async (valor, esperado) => {
    const res = await put(ANA, FERRETERIA, { toleranciaMonto: valor });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ toleranciaMonto: esperado });
    expect(await tolerancia(A)).toBe(esperado);
  });
});

describe('PUT /empresa/tolerancia: efecto y bitácora', () => {
  it('actualiza y deja una fila actualizar con antes, después y el usuario', async () => {
    await put(ANA, FERRETERIA, { toleranciaMonto: '12.50' }).then((r) =>
      expect(r.status).toBe(200),
    );
    await put(ANA, FERRETERIA, { toleranciaMonto: '3' });

    expect(await tolerancia(A)).toBe('3.0000');
    // ENT-1: la entidad que escribe el emisor pertenece a la lista canónica.
    for (const fila of await bitacora('actualizar')) {
      expect(ENTIDADES_BITACORA).toContain(fila.entidad);
    }
    expect(await bitacora('actualizar')).toEqual([
      {
        company_id: A,
        user_id: entorno.persona(ANA),
        entidad: 'companies',
        entidad_id: A,
        datos: {
          campo: 'tolerancia_monto',
          antes: '0.0000',
          despues: '12.5000',
        },
      },
      {
        company_id: A,
        user_id: entorno.persona(ANA),
        entidad: 'companies',
        entidad_id: A,
        datos: {
          campo: 'tolerancia_monto',
          antes: '12.5000',
          despues: '3.0000',
        },
      },
    ]);
  });

  it('la empresa sale del token: el admin de B solo cambia B', async () => {
    await put(CARMEN, TRANSPORTES, { toleranciaMonto: '20' }).then((r) =>
      expect(r.status).toBe(200),
    );

    expect(await tolerancia(B)).toBe('20.0000');
    expect(await tolerancia(A)).toBe('0.0000');
    const [fila] = await bitacora('actualizar');
    expect(fila).toMatchObject({ company_id: B, entidad_id: B });
  });

  it('aflojar la tolerancia no reconcilia: cambia la siguiente corrida, no las propuestas existentes', async () => {
    const servicio = entorno.app.get(ConciliacionService);
    await ds.query(
      `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda)
       VALUES ($1, 1, '2026-09-02', 'SPEI RECIBIDO', 'A1001', '1100.00', 'MXN')`,
      [A],
    );
    await ds.query(
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                         fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
       VALUES ($1, $2, $3, 'XAXX010101000', 'A', '1001', '2026-09-01T10:00:00', 'I', 'MXN',
               '1160.00', '1160.00', 'abierta', '{"_xml":"<x/>"}'::jsonb)`,
      [A, randomUUID(), FERRETERIA],
    );
    const propuestas = () =>
      filas<{ regla: string; score: string; diferencia_monto: string }>(
        ds,
        `SELECT regla, score::text AS score, diferencia_monto::text AS diferencia_monto
           FROM conciliaciones WHERE company_id = $1`,
        [A],
      );

    // Estricta: 60.00 de diferencia solo da una sugerencia de 0.5.
    await servicio.conciliar(A);
    expect(await propuestas()).toEqual([
      {
        regla: 'referencia_monto_diferente',
        score: '0.5000',
        diferencia_monto: '-60.0000',
      },
    ]);

    // D6: el PUT no vuelve a conciliar.
    await put(ANA, FERRETERIA, { toleranciaMonto: '100' }).then((r) =>
      expect(r.status).toBe(200),
    );
    expect(await propuestas()).toEqual([
      {
        regla: 'referencia_monto_diferente',
        score: '0.5000',
        diferencia_monto: '-60.0000',
      },
    ]);

    // La siguiente corrida ya usa la nueva tolerancia y conserva la diferencia real.
    await ds.query('TRUNCATE conciliaciones');
    await servicio.conciliar(A);
    expect(await propuestas()).toEqual([
      {
        regla: 'referencia_monto_exacto',
        score: '1.0000',
        diferencia_monto: '-60.0000',
      },
    ]);
  });
});
