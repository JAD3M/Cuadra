import { randomUUID } from 'crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
} from '../cargas/testing/app-de-cargas';
import { una } from '../database/testing/base-de-pruebas';
import type { RespuestaBandejaDto } from './dto/bandeja.dto';

/**
 * CU-14 de punta a punta contra Postgres real con RLS: la bandeja de
 * revisión (GET /bandeja). Los datos se preparan con la conexión del dueño;
 * el endpoint lee como cuadra_app.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let tokenA: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  tokenA = await entorno.token(ANA, FERRETERIA);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query('TRUNCATE cfdi, cargas, movimientos, conciliaciones CASCADE');
});

async function movimiento(
  empresa: string,
  o: {
    monto?: string;
    estado?: string;
    regla?: string | null;
    referencia?: string | null;
  } = {},
): Promise<string> {
  const regla = o.regla ?? null;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto,
                              estado, motivo_sin_match, regla_sin_match)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,$4,$5,
             CASE WHEN $6::text IS NULL THEN NULL ELSE 'Motivo guardado' END, $6)
     RETURNING id`,
    [
      empresa,
      linea++,
      o.referencia ?? null,
      o.monto ?? '1160.00',
      o.estado ?? 'abierto',
      regla,
    ],
  );
  return id;
}

async function factura(empresa: string, total = '1160.00'): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,'AAA010101AAA','XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             $3,$3,'abierta','PUE','{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), total],
  );
  return id;
}

async function conciliacion(
  empresa: string,
  cfdiId: string,
  movimientoId: string,
  estado: 'propuesta' | 'rechazada' | 'confirmada',
  o: { score?: string; regla?: string; diferencia?: string } = {},
): Promise<string> {
  const persona = estado === 'confirmada' ? entorno.persona(ANA) : null;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, regla, score,
                                 diferencia_monto, motivo, confirmada_por_id, confirmada_at)
     VALUES ($1,$2,$3,$4::text,'regla',$5,$6,$7,'Motivo de ' || $4::text,$8,
             CASE WHEN $8::uuid IS NULL THEN NULL ELSE now() END)
     RETURNING id`,
    [
      empresa,
      cfdiId,
      movimientoId,
      estado,
      o.regla ?? 'monto_unico',
      o.score ?? '0.9000',
      o.diferencia ?? '0.0000',
      persona,
    ],
  );
  return id;
}

/** Movimiento abierto con una propuesta vigente: cae en 'sugerencia'. */
async function sugerido(empresa: string, monto = '1160.00'): Promise<string> {
  const m = await movimiento(empresa, { monto });
  await conciliacion(empresa, await factura(empresa, monto), m, 'propuesta');
  return m;
}

/** Movimiento abierto con motivo guardado: cae en 'sin_match'. */
const sinMatch = (empresa: string, monto = '1160.00') =>
  movimiento(empresa, { monto, regla: 'sin_candidato_monto' });

/** Movimiento cerrado a mano (CU-15 aún no existe) con su confirmada. */
async function cerrado(empresa: string, monto = '1160.00'): Promise<string> {
  const m = await movimiento(empresa, { monto, estado: 'conciliado' });
  await conciliacion(empresa, await factura(empresa, monto), m, 'confirmada');
  return m;
}

const consultar = (token: string, query = '') =>
  request(entorno.app.getHttpServer())
    .get(`/bandeja${query}`)
    .auth(token, { type: 'bearer' });

async function listar(
  query = '',
  token = tokenA,
): Promise<RespuestaBandejaDto> {
  const res = await consultar(token, query).expect(200);
  return res.body as RespuestaBandejaDto;
}

const ids = (r: RespuestaBandejaDto) => r.datos.map((f) => f.movimientoId);

describe('BJ-1 derivación del estado', () => {
  it('S1: dos propuestas dan una sola fila en sugerencia', async () => {
    const m = await movimiento(A);
    await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.7000',
    });
    await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.9500',
    });
    const r = await listar();
    expect(ids(r)).toEqual([m]);
    expect(r.datos[0].estado).toBe('sugerencia');
  });

  it('S2: abierto sin conciliaciones y con motivo es sin_match', async () => {
    const m = await sinMatch(A);
    const r = await listar();
    expect(ids(r)).toEqual([m]);
    expect(r.datos[0].estado).toBe('sin_match');
  });

  it('S3: solo una rechazada y motivo guardado es sin_match', async () => {
    const m = await movimiento(A, { regla: 'monto_candidato_ocupado' });
    await conciliacion(A, await factura(A), m, 'rechazada');
    const r = await listar();
    expect(r.datos).toHaveLength(1);
    expect(r.datos[0].estado).toBe('sin_match');
  });

  it('S4: sin evaluar no se lista con ningún filtro', async () => {
    await movimiento(A);
    const r = await listar(
      '?estado=sugerencia&estado=sin_match&estado=conciliado',
    );
    expect(r.datos).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('S5: cargos y descartados no se listan', async () => {
    await movimiento(A, { monto: '-500.00', regla: 'sin_candidato_monto' });
    await movimiento(A, { estado: 'descartado', regla: 'sin_candidato_monto' });
    const r = await listar(
      '?estado=sugerencia&estado=sin_match&estado=conciliado',
    );
    expect(r.datos).toEqual([]);
  });

  it('S6: un conciliado a mano se lista solo cuando se pide', async () => {
    const m = await cerrado(A);
    expect(ids(await listar())).toEqual([]);
    const r = await listar('?estado=conciliado');
    expect(ids(r)).toEqual([m]);
    expect(r.datos[0].estado).toBe('conciliado');
  });
});

describe('BJ-2 filtro estado', () => {
  it('S7: sin estado, solo sugerencia y sin_match', async () => {
    const s = await sugerido(A, '300.00');
    const n = await sinMatch(A, '200.00');
    await cerrado(A, '100.00');
    expect(ids(await listar())).toEqual([s, n]);
  });

  it('S8: estado=conciliado solo trae conciliados', async () => {
    await sugerido(A, '300.00');
    await sinMatch(A, '200.00');
    const c = await cerrado(A, '100.00');
    expect(ids(await listar('?estado=conciliado'))).toEqual([c]);
  });

  it('S9: estado repetido une los estados pedidos', async () => {
    const s = await sugerido(A, '300.00');
    await sinMatch(A, '200.00');
    const c = await cerrado(A, '100.00');
    expect(ids(await listar('?estado=sugerencia&estado=conciliado'))).toEqual([
      s,
      c,
    ]);
  });

  it.each(['?estado=foo', '?estado=', '?estado=sugerencia&estado=sugerencia'])(
    'S10: %s da 400',
    async (query) => {
      await consultar(tokenA, query).expect(400);
    },
  );
});

describe('BJ-4 orden', () => {
  it('S15: monto descendente numérico, no de texto', async () => {
    await sinMatch(A, '100.00');
    await sinMatch(A, '1500.00');
    await sinMatch(A, '20.00');
    const r = await listar();
    expect(r.datos.map((f) => f.monto)).toEqual([
      '1500.0000',
      '100.0000',
      '20.0000',
    ]);
  });

  it('S16: empate de monto por id ascendente', async () => {
    const creados = [await sinMatch(A), await sinMatch(A), await sinMatch(A)];
    const esperado = [...creados].sort();
    expect(ids(await listar())).toEqual(esperado);
  });
});
