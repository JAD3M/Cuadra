import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import {
  ANA,
  CARMEN,
  FERRETERIA,
  JORGE,
  LUIS,
  TRANSPORTES,
  type AppDeCargas,
  levantarAppDeCargas,
} from '../cargas/testing/app-de-cargas';
import { una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';

/**
 * Historia 9.1 (FR-36, AD-10, AD-11): `GET /medicion/desacuerdo` expone la
 * tasa de desacuerdo de la historia 6.2 solo al administrador y solo de su
 * empresa. Sale de una consulta sobre `evidencia_sombra`, no de un número
 * guardado. SINTÉTICO: las propuestas las crea el motor con datos de prueba.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let linea = 0;
let n = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, evidencia_sombra, bitacora CASCADE',
  );
}

beforeEach(limpiar);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

/** Una propuesta de la regla 1 creada por el motor (lleva `habria_cerrado`). */
async function propuesta(empresa: string, rfc: string): Promise<string> {
  n++;
  await ds.query(
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,'1160.00','MXN','bbva')`,
    [empresa, linea++, `A${1000 + n}`],
  );
  await ds.query(
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A',$4,'2026-09-01T10:00:00','I','MXN',1160,1160,'abierta',
             '{"_xml":"<x/>"}'::jsonb)`,
    [empresa, randomUUID(), rfc, `${1000 + n}`],
  );
  await entorno.app.get(ConciliacionService).conciliar(empresa);
  const { id } = await una<{ id: string }>(
    ds,
    `SELECT id FROM decisiones WHERE company_id = $1 AND estado = 'propuesta'
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [empresa],
  );
  return id;
}

const http = () => request(entorno.app.getHttpServer());
const medicion = (token: string) =>
  http().get('/medicion/desacuerdo').set('Cookie', token);
const como = (usuario: string, rfc: string) => entorno.token(usuario, rfc);

const confirmar = async (id: string) =>
  http()
    .post(`/conciliaciones/${id}/confirmar`)
    .set('Cookie', await entorno.token(ANA, FERRETERIA))
    .send({})
    .expect(200);
const rechazar = async (id: string) =>
  http()
    .post(`/conciliaciones/${id}/rechazar`)
    .set('Cookie', await entorno.token(ANA, FERRETERIA))
    .send({ motivo: 'No corresponde' })
    .expect(200);

describe('GET /medicion/desacuerdo (historia 9.1)', () => {
  it('el administrador ve cuántas propuestas se evaluaron, cuántas tuvieron desacuerdo y la tasa', async () => {
    await confirmar(await propuesta(A, FERRETERIA));
    await rechazar(await propuesta(A, FERRETERIA));

    const res = await medicion(await como(ANA, FERRETERIA)).expect(200);
    expect(res.body).toEqual({
      propuestas: 2,
      tratadas: 2,
      desacuerdos: 1,
      tasa: '0.5000',
    });
  });

  it('se calcula en cada consulta: un rechazo nuevo cambia la tasa sin guardar nada', async () => {
    const primera = await propuesta(A, FERRETERIA);
    await confirmar(primera);
    expect(
      (await medicion(await como(ANA, FERRETERIA)).expect(200)).body,
    ).toMatchObject({
      tratadas: 1,
      desacuerdos: 0,
      tasa: '0.0000',
    });

    await rechazar(await propuesta(A, FERRETERIA));
    expect(
      (await medicion(await como(ANA, FERRETERIA)).expect(200)).body,
    ).toMatchObject({
      tratadas: 2,
      desacuerdos: 1,
      tasa: '0.5000',
    });
  });

  it('una empresa sin propuestas recibe ceros y tasa null, no un cero engañoso', async () => {
    const res = await medicion(await como(ANA, FERRETERIA)).expect(200);
    expect(res.body).toEqual({
      propuestas: 0,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
  });

  it('con propuestas pero ninguna tratada, la tasa también es null', async () => {
    await propuesta(A, FERRETERIA);
    const res = await medicion(await como(ANA, FERRETERIA)).expect(200);
    expect(res.body).toEqual({
      propuestas: 1,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
  });

  it('la administración de otra empresa nunca ve los datos de la ajena', async () => {
    await rechazar(await propuesta(A, FERRETERIA));
    await propuesta(B, TRANSPORTES);

    const deB = await medicion(await como(CARMEN, TRANSPORTES)).expect(200);
    expect(deB.body).toEqual({
      propuestas: 1,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
    const deA = await medicion(await como(ANA, FERRETERIA)).expect(200);
    expect(deA.body).toMatchObject({ propuestas: 1, desacuerdos: 1 });
  });

  it('el contador y el revisor reciben 403', async () => {
    await medicion(await como(LUIS, FERRETERIA)).expect(403);
    await medicion(await como(JORGE, TRANSPORTES)).expect(403);
  });

  it('sin sesión: 401', async () => {
    await http().get('/medicion/desacuerdo').expect(401);
  });
});
