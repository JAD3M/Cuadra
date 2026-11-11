import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from '../cargas/testing/app-de-cargas';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * Un carácter nulo (U+0000) en un texto libre hacía fallar a Postgres y la API
 * respondía 500. `configurarApp` lo corta con un 400 antes de tocar la base:
 * aquí se prueba en los endpoints reales con motivo.
 */

jest.setTimeout(30_000);

const NUL = String.fromCharCode(0);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let tokenAna: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  tokenAna = await entorno.token(ANA, FERRETERIA);
}, 60_000);

afterAll(async () => {
  // Las pruebas de migraciones deshacen el CHECK de la bitácora: no le dejan filas.
  if (ds?.isInitialized) {
    await ds.query(
      'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, bitacora CASCADE',
    );
  }
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, bitacora CASCADE',
  );
});

async function movimiento(estado: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,NULL,$2,'2026-09-02','SPEI RECIBIDO','1160.00',$3) RETURNING id`,
    [A, linea++, estado],
  );
  return id;
}

async function confirmada(): Promise<string> {
  const movimientoId = await movimiento('conciliado');
  const { id: cfdiId } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,NULL,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             1160,1160,'conciliada','PUE','{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [A, randomUUID(), FERRETERIA],
  );
  return sembrarDecision(ds, {
    companyId: A,
    movimientoId,
    cfdiId,
    estado: 'confirmada',
    origen: 'regla',
    regla: 'monto_unico',
    score: '0.9000',
    diferenciaMonto: '0.0000',
    motivo: 'Motivo de la propuesta',
    confirmadaPorId: entorno.persona(LUIS),
  });
}

const post = (ruta: string, cuerpo: object) =>
  request(entorno.app.getHttpServer())
    .post(ruta)
    .set('Cookie', tokenAna)
    .send(cuerpo);

const conteo = async (tabla: string) =>
  Number(
    (await una<{ n: string }>(ds, `SELECT count(*) AS n FROM ${tabla}`)).n,
  );

describe('carácter nulo en un motivo: 400, no 500', () => {
  it('reabrir una confirmación', async () => {
    const id = await confirmada();

    await post(`/conciliaciones/${id}/reabrir`, {
      motivo: `error${NUL}de captura`,
    }).expect(400);

    expect(
      (
        await una<{ estado: string }>(
          ds,
          `SELECT estado FROM decisiones WHERE id = $1`,
          [id],
        )
      ).estado,
    ).toBe('confirmada');
    expect(
      await filas(ds, `SELECT 1 FROM bitacora WHERE accion = 'reabrir'`),
    ).toEqual([]);
  });

  it('descartar un movimiento', async () => {
    const id = await movimiento('abierto');

    await post(`/movimientos/${id}/descartar`, {
      motivo: `comisión${NUL}bancaria`,
    }).expect(400);

    expect(await conteo('decisiones')).toBe(0);
    expect(
      (
        await una<{ estado: string }>(
          ds,
          `SELECT estado FROM movimientos WHERE id = $1`,
          [id],
        )
      ).estado,
    ).toBe('abierto');
  });

  it('un filtro de la bitácora con el carácter nulo', async () => {
    await request(entorno.app.getHttpServer())
      .get('/bitacora?entidad=decisiones%00')
      .set('Cookie', tokenAna)
      .expect(400);
  });

  it('el motivo normal con acentos y saltos de línea sigue funcionando', async () => {
    const id = await movimiento('abierto');

    await post(`/movimientos/${id}/descartar`, {
      motivo: 'Comisión ñ ✓\nsegunda línea',
    }).expect(200);

    expect(await conteo('decisiones')).toBe(1);
  });
});
