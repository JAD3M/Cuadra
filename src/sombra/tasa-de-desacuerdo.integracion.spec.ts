import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  CARMEN,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { SombraService } from './sombra.service';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { una } from '../database/testing/base-de-pruebas';

/**
 * Historia 6.2 (FR-35, AD-10, AD-12): la tasa de desacuerdo se calcula con una
 * consulta sobre los eventos de `evidencia_sombra`; nada se guarda. Cada caso
 * del criterio, con datos de dos empresas.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let servicio: ConciliacionService;
let sombra: SombraService;
let A: string;
let B: string;
let tokenA: string;
let tokenB: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  servicio = entorno.app.get(ConciliacionService);
  sombra = entorno.app.get(SombraService);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenA = await entorno.token(ANA, FERRETERIA);
  tokenB = await entorno.token(CARMEN, TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, evidencia_sombra, bitacora CASCADE',
  );
}

beforeEach(limpiar);

async function movimiento(
  empresa: string,
  o: { referencia?: string; banco?: string } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,'1160.00','MXN',$4) RETURNING id`,
    [empresa, linea++, o.referencia ?? 'A1001', o.banco ?? 'bbva'],
  );
  return id;
}

async function factura(empresa: string, folio = '1001'): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A',$4,'2026-09-01T10:00:00','I','MXN',1160,1160,'abierta',
             '{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), empresa === B ? TRANSPORTES : FERRETERIA, folio],
  );
  return id;
}

/** Una propuesta de la regla 1, creada por el motor (lleva `habria_cerrado`). */
async function propuestaDeRegla1(
  empresa: string,
  o: { referencia?: string; folio?: string; banco?: string } = {},
): Promise<string> {
  await movimiento(empresa, o);
  await factura(empresa, o.folio);
  await servicio.conciliar(empresa);
  const { id } = await una<{ id: string }>(
    ds,
    `SELECT id FROM decisiones WHERE company_id = $1 AND estado = 'propuesta'
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [empresa],
  );
  return id;
}

const post = (ruta: string, token: string, cuerpo: object = {}) =>
  request(entorno.app.getHttpServer())
    .post(ruta)
    .set('Cookie', token)
    .send(cuerpo);

let n = 0;
/** Una propuesta nueva de la regla 1 en la empresa, con su referencia propia. */
const nueva = (empresa: string) => {
  n++;
  return propuestaDeRegla1(empresa, {
    referencia: `A${1000 + n}`,
    folio: `${1000 + n}`,
  });
};
const lote = (token: string, ids: string[], desmarcadas: string[] = []) =>
  post('/conciliaciones/lotes', token, { ids, desmarcadas }).expect(200);
const confirmar = (id: string, token: string) =>
  post(`/conciliaciones/${id}/confirmar`, token).expect(200);

describe('tasa de desacuerdo del modo sombra (S3-S6)', () => {
  it('sin evidencia no hay tasa', async () => {
    expect(await sombra.tasaDesacuerdo(A)).toEqual({
      propuestas: 0,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
  });

  it('confirmar tal cual no es desacuerdo', async () => {
    await confirmar(await nueva(A), tokenA);
    expect(await sombra.tasaDesacuerdo(A)).toMatchObject({
      tratadas: 1,
      desacuerdos: 0,
      tasa: '0.0000',
    });
  });

  it('desmarcar y luego confirmar igual no es desacuerdo (S4)', async () => {
    const id = await nueva(A);
    const otra = await nueva(A);
    await lote(tokenA, [otra], [id]); // la desmarca
    await confirmar(id, tokenA); // y la confirma después

    expect(await sombra.tasaDesacuerdo(A)).toMatchObject({
      tratadas: 2,
      desacuerdos: 0,
    });
  });

  it('desmarcar y resolver de otra forma sí es desacuerdo (S3)', async () => {
    const rechazada = await nueva(A);
    const otra = await nueva(A);
    const sinConfirmar = await nueva(A);
    await lote(tokenA, [otra], [rechazada, sinConfirmar]);
    await post(`/conciliaciones/${rechazada}/rechazar`, tokenA, {
      motivo: 'No corresponde',
    }).expect(200);

    // `rechazada` (desmarcó y rechazó) y `sinConfirmar` (desmarcó y no la
    // confirmó: la resolvió por otra vía o sigue sin resolver) cuentan.
    expect(await sombra.tasaDesacuerdo(A)).toMatchObject({
      tratadas: 3,
      desacuerdos: 2,
      tasa: '0.6667',
    });
  });

  it('un rechazo y una reapertura cuentan como desacuerdo (S5)', async () => {
    const rechazada = await nueva(A);
    const reabierta = await nueva(A);
    const conforme = await nueva(A);
    await post(`/conciliaciones/${rechazada}/rechazar`, tokenA, {
      motivo: 'No corresponde',
    }).expect(200);
    await confirmar(reabierta, tokenA);
    await post(`/conciliaciones/${reabierta}/reabrir`, tokenA, {
      motivo: 'Error',
    }).expect(200);
    await confirmar(conforme, tokenA);

    // Reabrir libera el movimiento y el motor re-propone: esa decisión nueva es
    // una propuesta más (con su propia evidencia) que nadie ha tocado todavía.
    expect(await sombra.tasaDesacuerdo(A)).toMatchObject({
      propuestas: 4,
      tratadas: 3,
      desacuerdos: 2,
      tasa: '0.6667',
    });
  });

  it('una propuesta sin tocar no entra en la tasa pero sí en las propuestas', async () => {
    await nueva(A);
    await confirmar(await nueva(A), tokenA);

    expect(await sombra.tasaDesacuerdo(A)).toMatchObject({
      propuestas: 2,
      tratadas: 1,
      desacuerdos: 0,
    });
  });

  it('se calcula al consultar: un evento nuevo cambia la respuesta (S6)', async () => {
    const id = await nueva(A);
    await confirmar(id, tokenA);
    expect((await sombra.tasaDesacuerdo(A)).desacuerdos).toBe(0);

    await post(`/conciliaciones/${id}/reabrir`, tokenA, {
      motivo: 'Error',
    }).expect(200);

    expect((await sombra.tasaDesacuerdo(A)).desacuerdos).toBe(1);
  });

  it('cada empresa ve solo su propia tasa', async () => {
    await post(`/conciliaciones/${await nueva(A)}/rechazar`, tokenA, {
      motivo: 'No corresponde',
    }).expect(200);
    await confirmar(await nueva(B), tokenB);
    await confirmar(await nueva(B), tokenB);

    expect(await sombra.tasaDesacuerdo(A)).toMatchObject({
      propuestas: 1,
      desacuerdos: 1,
      tasa: '1.0000',
    });
    expect(await sombra.tasaDesacuerdo(B)).toMatchObject({
      propuestas: 2,
      desacuerdos: 0,
      tasa: '0.0000',
    });
  });
});
