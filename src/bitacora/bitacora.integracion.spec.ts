import { randomUUID } from 'crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { una } from '../database/testing/base-de-pruebas';

/**
 * CU-16 (lectura) de punta a punta contra Postgres real con RLS:
 * GET /conciliaciones/:id/historial y GET /bitacora. Los datos se preparan
 * con la conexión del dueño; los endpoints leen como cuadra_app. Las filas
 * de confirmar y rechazar salen de los endpoints reales de CU-15.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenAna: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenAna = await entorno.token(ANA, FERRETERIA);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, conciliaciones, bitacora CASCADE',
  );
  // confirmar y rechazar vuelven a evaluar al liberar un lado; aquí no
  // interesa el motor.
  jest
    .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
    .mockResolvedValue({ propuestas: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function movimiento(empresa: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO','1160.00','abierto')
     RETURNING id`,
    [empresa, linea++],
  );
  return id;
}

async function factura(empresa: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             '1160.00','1160.00','abierta','PUE','{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), FERRETERIA],
  );
  return id;
}

/** Propuesta lista para resolver. Con `crear` deja la fila del motor. */
async function propuesta(
  empresa = A,
  o: { movimientoId?: string; crear?: boolean } = {},
) {
  const cfdiId = await factura(empresa);
  const movimientoId = o.movimientoId ?? (await movimiento(empresa));
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, regla, score,
                                 diferencia_monto, motivo)
     VALUES ($1,$2,$3,'propuesta','regla','monto_unico','0.9000','0.0000','Motivo de propuesta')
     RETURNING id`,
    [empresa, cfdiId, movimientoId],
  );
  if (o.crear !== false) await crearDelMotor(empresa, id, cfdiId, movimientoId);
  return { id, cfdiId, movimientoId };
}

/** La fila 'crear' que escribe el motor (user_id NULL), en el pasado. */
async function crearDelMotor(
  empresa: string,
  id: string,
  cfdiId: string,
  movimientoId: string,
): Promise<void> {
  await ds.query(
    `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent, created_at)
     VALUES ($1,NULL,'conciliaciones',$2,'crear',$3::jsonb,'203.0.113.7','jest',
             now() - interval '1 minute')`,
    [
      empresa,
      id,
      JSON.stringify({
        despues: { estado: 'propuesta' },
        origen: 'regla',
        regla: 'monto_unico',
        score: '0.9000',
        diferenciaMonto: '0.0000',
        cfdiId,
        movimientoId,
      }),
    ],
  );
}

const confirmar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/confirmar`)
    .auth(token, { type: 'bearer' })
    .send();

const rechazar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/rechazar`)
    .auth(token, { type: 'bearer' })
    .send({ motivo: 'No corresponde' });

const historial = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .get(`/conciliaciones/${id}/historial`)
    .auth(token, { type: 'bearer' });

interface Evento {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  datos: Record<string, any>;
  createdAt: string;
  usuario: { nombre: string; email: string } | null;
}

/** Los eventos de la respuesta, tipados. */
const eventosDe = (res: request.Response) =>
  (res.body as { datos: Evento[] }).datos;

const accionesDe = (res: request.Response) =>
  eventosDe(res).map((e) => e.accion);

const filaDe = (id: string, accion: string) =>
  una<{ datos: Record<string, unknown> }>(
    ds,
    'SELECT datos FROM bitacora WHERE entidad_id = $1 AND accion = $2',
    [id, accion],
  );

describe('GET /conciliaciones/:id/historial (AU-10 a AU-14)', () => {
  it('AU-10: un id que no es UUID es 400', async () => {
    await historial('no-es-uuid').expect(400);
  });

  it('AU-10: inexistente y ajena dan el mismo 404', async () => {
    const ajena = await propuesta(B);
    const inexistente = await historial(randomUUID()).expect(404);
    const deOtraEmpresa = await historial(ajena.id).expect(404);
    expect(deOtraEmpresa.body).toEqual(inexistente.body);
  });

  it('AU-11 y AU-14: crear y luego confirmar, en orden, con su actor', async () => {
    const { id } = await propuesta();
    await confirmar(id).expect(200);

    const res = await historial(id).expect(200);
    const ana = await una<{ nombre: string; email: string }>(
      ds,
      'SELECT nombre, email FROM users WHERE email = $1',
      [ANA],
    );

    expect(accionesDe(res)).toEqual(['crear', 'confirmar']);
    expect(eventosDe(res)[0]).toMatchObject({
      entidad: 'conciliaciones',
      entidadId: id,
      usuario: null,
      datos: { origen: 'regla' },
    });
    expect(eventosDe(res)[1].usuario).toEqual(ana);
    expect(Date.parse(eventosDe(res)[0].createdAt)).toBeLessThan(
      Date.parse(eventosDe(res)[1].createdAt),
    );
  });

  it('AU-11: no expone ip ni userAgent', async () => {
    const { id } = await propuesta();
    const res = await historial(id).expect(200);
    expect(res.body).toEqual({ datos: [expect.any(Object)] });
    for (const evento of eventosDe(res)) {
      expect(evento).not.toHaveProperty('ip');
      expect(evento).not.toHaveProperty('userAgent');
    }
    expect(JSON.stringify(res.body)).not.toContain('203.0.113.7');
  });

  it('AU-12: una propuesta anterior a CU-16 devuelve solo lo posterior', async () => {
    const { id } = await propuesta(A, { crear: false });
    const vacio = await historial(id).expect(200);
    expect(vacio.body).toEqual({ datos: [] });

    await rechazar(id).expect(200);
    const res = await historial(id).expect(200);
    expect(accionesDe(res)).toEqual(['rechazar']);
  });

  it('AU-13: las dos formas de datos de CU-15 salen tal como se guardaron', async () => {
    const confirmada = await propuesta();
    const rechazada = await propuesta();
    await confirmar(confirmada.id).expect(200);
    await rechazar(rechazada.id).expect(200);

    const deConfirmar = await historial(confirmada.id).expect(200);
    const deRechazar = await historial(rechazada.id).expect(200);

    const c = eventosDe(deConfirmar).find((e) => e.accion === 'confirmar');
    const r = eventosDe(deRechazar).find((e) => e.accion === 'rechazar');
    expect(c?.datos).toEqual((await filaDe(confirmada.id, 'confirmar')).datos);
    expect(c?.datos).toMatchObject({
      cfdi: { id: confirmada.cfdiId },
      movimiento: { id: confirmada.movimientoId },
    });
    expect(r?.datos).toEqual((await filaDe(rechazada.id, 'rechazar')).datos);
    expect(r?.datos).toMatchObject({
      cfdiId: rechazada.cfdiId,
      movimientoId: rechazada.movimientoId,
    });
  });

  it('AU-13: el rechazo de una hermana aparece en el historial de la hermana', async () => {
    const movimientoId = await movimiento(A);
    const ganadora = await propuesta(A, { movimientoId });
    const hermana = await propuesta(A, { movimientoId });
    await confirmar(ganadora.id).expect(200);

    const res = await historial(hermana.id).expect(200);
    expect(accionesDe(res)).toEqual(['crear', 'rechazar']);
    expect(eventosDe(res)[1].entidadId).toBe(hermana.id);
  });

  it('AU-10: contador y revisor leen; sin token es 401', async () => {
    const { id } = await propuesta();
    await historial(id, await entorno.token(LUIS, FERRETERIA)).expect(200);
    const deB = await propuesta(B);
    await historial(deB.id, await entorno.token(JORGE, TRANSPORTES)).expect(
      200,
    );
    await request(entorno.app.getHttpServer())
      .get(`/conciliaciones/${id}/historial`)
      .expect(401);
  });
});
