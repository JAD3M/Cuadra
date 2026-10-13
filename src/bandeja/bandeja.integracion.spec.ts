import { randomUUID } from 'crypto';
import request from 'supertest';
import { abrirSesion } from '../testing/sesion-de-pruebas';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { una } from '../database/testing/base-de-pruebas';
import { aTexto, dinero, sumar } from '../common/dinero';
import type { RespuestaBandejaDto, ResumenBandejaDto } from './dto/bandeja.dto';

/**
 * CU-14 de punta a punta contra Postgres real con RLS: la bandeja de
 * revisión (GET /bandeja). Los datos se preparan con la conexión del dueño;
 * el endpoint lee como cuadra_app.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenA: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
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
    moneda?: string;
  } = {},
): Promise<string> {
  const regla = o.regla ?? null;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto,
                              estado, motivo_sin_match, regla_sin_match, moneda)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,$4,$5,
             CASE WHEN $6::text IS NULL THEN NULL ELSE 'Motivo guardado' END, $6, $7)
     RETURNING id`,
    [
      empresa,
      linea++,
      o.referencia ?? null,
      o.monto ?? '1160.00',
      o.estado ?? 'abierto',
      regla,
      o.moneda ?? 'MXN',
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
    .set('Cookie', token);

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

  it('S3: solo una rechazada y motivo guardado es sin_match con ese motivo', async () => {
    const m = await movimiento(A, { regla: 'monto_candidato_ocupado' });
    await conciliacion(A, await factura(A), m, 'rechazada');
    const r = await listar();
    expect(r.datos).toHaveLength(1);
    expect(r.datos[0]).toMatchObject({
      estado: 'sin_match',
      regla: 'monto_candidato_ocupado',
      motivo: 'Motivo guardado',
    });
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

describe('RS-C5 tras confirmar de verdad (CU-15)', () => {
  it('el bucket conciliado lista el par y sugerencia ya no', async () => {
    const m = await sugerido(A);
    const { id } = await una<{ id: string }>(
      ds,
      `SELECT id FROM conciliaciones WHERE movimiento_id = $1`,
      [m],
    );

    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${id}/confirmar`)
      .set('Cookie', tokenA)
      .expect(200);

    expect(ids(await listar())).toEqual([]);
    const r = await listar('?estado=conciliado');
    expect(ids(r)).toEqual([m]);
    expect(r.datos[0]).toMatchObject({
      estado: 'conciliado',
      propuestasCount: 0,
    });
    expect(r.datos[0].mejorPropuesta?.conciliacionId).toBe(id);
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

describe('BJ-3 paginación', () => {
  beforeEach(async () => {
    await ds.query(
      `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto,
                                motivo_sin_match, regla_sin_match)
       SELECT $1, g, '2026-09-02', 'SPEI', g, 'Motivo guardado', 'sin_candidato_monto'
         FROM generate_series(1, 120) g`,
      [A],
    );
  });

  it('S11: por defecto 50 filas, total 120', async () => {
    const r = await listar();
    expect(r).toMatchObject({ pagina: 1, limite: 50, total: 120 });
    expect(r.datos).toHaveLength(50);
  });

  it('S12: pagina 3 de 50 trae las 20 restantes', async () => {
    const r = await listar('?pagina=3&limite=50');
    expect(r.datos).toHaveLength(20);
    expect(r.total).toBe(120);
  });

  it.each([
    '?limite=201',
    '?pagina=0',
    '?limite=abc',
    '?pagina=1.5',
    '?limite=0',
  ])('S13: %s da 400', async (query) => {
    await consultar(tokenA, query).expect(400);
  });

  it('S13: limite=200 se acepta', async () => {
    const r = await listar('?limite=200');
    expect(r.datos).toHaveLength(120);
  });

  it('S14: una página fuera de rango va vacía y conserva el total', async () => {
    const r = await listar('?pagina=99');
    expect(r.datos).toEqual([]);
    expect(r.total).toBe(120);
  });
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

  it('S16: empate de monto por id ascendente, sin repetir entre páginas', async () => {
    const creados = [await sinMatch(A), await sinMatch(A), await sinMatch(A)];
    const esperado = [...creados].sort();
    expect(ids(await listar())).toEqual(esperado);
    const p1 = await listar('?limite=2&pagina=1');
    const p2 = await listar('?limite=2&pagina=2');
    expect([...ids(p1), ...ids(p2)]).toEqual(esperado);
  });
});

describe('BJ-5 forma de la respuesta', () => {
  it('S17: los montos viajan como texto decimal', async () => {
    await sinMatch(A, '1234.50');
    const [fila] = (await listar()).datos;
    expect(fila.monto).toBe('1234.5000');
    expect(typeof fila.monto).toBe('string');
  });

  it('S17: score, diferencia y total del CFDI también son texto', async () => {
    const m = await movimiento(A, { monto: '1160.00' });
    await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.9500',
      diferencia: '0.5000',
    });
    const { mejorPropuesta } = (await listar()).datos[0];
    expect(mejorPropuesta).toMatchObject({
      score: '0.9500',
      diferenciaMonto: '0.5000',
      cfdi: { total: '1160.0000', moneda: 'MXN', metodoPago: 'PUE' },
    });
  });

  it('S18: la respuesta nunca trae el XML crudo', async () => {
    await sugerido(A);
    const res = await consultar(tokenA).expect(200);
    const texto = JSON.stringify(res.body);
    expect(texto).not.toMatch(/xmlRaw|xml_raw|_xml/);
  });

  it('S19: sin_match no tiene mejor propuesta ni propuestas', async () => {
    await sinMatch(A);
    const [fila] = (await listar()).datos;
    expect(fila.mejorPropuesta).toBeNull();
    expect(fila.propuestasCount).toBe(0);
    expect(fila.moneda).toBe('MXN');
  });
});

describe('BJ-6 motivo y regla por estado', () => {
  it('S20: sugerencia lleva el motivo y la regla de la mejor propuesta', async () => {
    const m = await movimiento(A);
    const c = await conciliacion(A, await factura(A), m, 'propuesta', {
      regla: 'referencia_exacta',
    });
    const [fila] = (await listar()).datos;
    expect(fila).toMatchObject({
      estado: 'sugerencia',
      motivo: 'Motivo de propuesta',
      regla: 'referencia_exacta',
    });
    expect(fila.mejorPropuesta).toMatchObject({
      conciliacionId: c,
      motivo: fila.motivo,
      regla: fila.regla,
    });
  });

  it('S21: sin_match lleva las columnas guardadas en el movimiento', async () => {
    await movimiento(A, { regla: 'monto_multiples_candidatos' });
    const [fila] = (await listar()).datos;
    expect(fila).toMatchObject({
      motivo: 'Motivo guardado',
      regla: 'monto_multiples_candidatos',
    });
  });

  it('S22: conciliado toma motivo y regla de la confirmada', async () => {
    const m = await movimiento(A, { estado: 'conciliado' });
    const c = await conciliacion(A, await factura(A), m, 'confirmada', {
      regla: 'referencia_exacta',
    });
    const [fila] = (await listar('?estado=conciliado')).datos;
    expect(fila).toMatchObject({
      estado: 'conciliado',
      motivo: 'Motivo de confirmada',
      regla: 'referencia_exacta',
      propuestasCount: 0,
    });
    expect(fila.mejorPropuesta?.conciliacionId).toBe(c);
  });
});

describe('BJ-7 mejor propuesta', () => {
  it('S23: gana el score más alto y se cuentan las dos', async () => {
    const m = await movimiento(A);
    await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.7000',
    });
    const alta = await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.9500',
    });
    const [fila] = (await listar()).datos;
    expect(fila.mejorPropuesta?.conciliacionId).toBe(alta);
    expect(fila.propuestasCount).toBe(2);
  });

  it('S24: con el mismo score gana el id menor', async () => {
    const m = await movimiento(A);
    const c1 = await conciliacion(A, await factura(A), m, 'propuesta');
    const c2 = await conciliacion(A, await factura(A), m, 'propuesta');
    const [fila] = (await listar()).datos;
    expect(fila.mejorPropuesta?.conciliacionId).toBe([c1, c2].sort()[0]);
  });

  it('S25: las rechazadas no cuentan ni se eligen', async () => {
    const m = await movimiento(A);
    const viva = await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.5000',
    });
    await conciliacion(A, await factura(A), m, 'rechazada', {
      score: '0.9900',
    });
    const [fila] = (await listar()).datos;
    expect(fila).toMatchObject({ estado: 'sugerencia', propuestasCount: 1 });
    expect(fila.mejorPropuesta?.conciliacionId).toBe(viva);
  });
});

describe('BJ-8 acceso y aislamiento', () => {
  it('S26: cada empresa ve solo lo suyo y el total la respeta', async () => {
    const deA = await sinMatch(A);
    await sinMatch(B);
    await sinMatch(B);
    const r = await listar();
    expect(ids(r)).toEqual([deA]);
    expect(r.total).toBe(1);
  });

  it('S27: el CFDI de otra empresa nunca es candidato', async () => {
    const m = await movimiento(A);
    // Ni el dueño de la tabla puede cruzar un CFDI de B: la FK compuesta
    // (company_id, cfdi_id) lo rechaza. Y la bandeja de A no lo trae.
    const ajeno = await factura(B);
    await expect(
      ds.query(
        `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen)
         VALUES ($1,$2,$3,'propuesta','regla')`,
        [A, ajeno, m],
      ),
    ).rejects.toThrow(/fk_conciliaciones_cfdi/);
    const r = await listar('?estado=sugerencia&estado=sin_match');
    expect(JSON.stringify(r)).not.toContain(ajeno);
  });

  it('S28: contador y revisor también leen', async () => {
    await consultar(await entorno.token(LUIS, FERRETERIA)).expect(200);
    await consultar(await entorno.token(JORGE, TRANSPORTES)).expect(200);
  });

  it('S29: sin token es 401', async () => {
    await request(entorno.app.getHttpServer()).get('/bandeja').expect(401);
  });

  it('un companyId en la query se rechaza', async () => {
    await consultar(tokenA, `?companyId=${B}`).expect(400);
  });
});

describe('BJ-9 solo lectura', () => {
  it('S30: la consulta no cambia ninguna tabla', async () => {
    await sugerido(A, '300.00');
    await sinMatch(A, '200.00');
    await cerrado(A, '100.00');
    const foto = () =>
      ds.query<unknown[]>(
        `SELECT (SELECT json_agg(m ORDER BY id) FROM movimientos m) AS m,
                (SELECT json_agg(c ORDER BY id) FROM conciliaciones c) AS c`,
      );
    const antes = await foto();
    await listar('?estado=sugerencia&estado=sin_match&estado=conciliado');
    expect(await foto()).toEqual(antes);
  });

  it('S31: una empresa sin filas recibe 200 con lista vacía', async () => {
    const r = await listar();
    expect(r).toEqual({ datos: [], pagina: 1, limite: 50, total: 0 });
  });
});

/** Mismo orden que el endpoint: estado y moneda se piden aparte. */
const ESTADOS = ['conciliado', 'sugerencia', 'sin_match'] as const;

const resumir = (token: string, query = '') =>
  request(entorno.app.getHttpServer())
    .get(`/bandeja/resumen${query}`)
    .set('Cookie', token);

async function resumen(token = tokenA, query = ''): Promise<ResumenBandejaDto> {
  const res = await resumir(token, query).expect(200);
  return res.body as ResumenBandejaDto;
}

/** Datos mixtos para el resumen: ver RS-2. */
async function sembrarMixto(empresa: string): Promise<void> {
  // 2 sugerencias, una con dos propuestas vigentes y una rechazada.
  const m1 = await movimiento(empresa, { monto: '0.10' });
  await conciliacion(empresa, await factura(empresa), m1, 'propuesta', {
    score: '0.7000',
  });
  await conciliacion(empresa, await factura(empresa), m1, 'propuesta', {
    score: '0.9500',
  });
  await conciliacion(empresa, await factura(empresa), m1, 'rechazada');
  await sugerido(empresa, '0.20');
  // 3 sin_match, uno con solo una conciliación rechazada.
  await sinMatch(empresa, '10.00');
  await sinMatch(empresa, '20.00');
  const r = await movimiento(empresa, {
    monto: '30.00',
    regla: 'monto_candidato_ocupado',
  });
  await conciliacion(empresa, await factura(empresa), r, 'rechazada');
  // 1 conciliado.
  await cerrado(empresa, '500.00');
  // No cuentan: abierto sin evaluar, cargo, descartado.
  await movimiento(empresa, { monto: '999.00' });
  await movimiento(empresa, { monto: '-50.00', regla: 'sin_candidato_monto' });
  await movimiento(empresa, {
    monto: '70.00',
    estado: 'descartado',
    regla: 'sin_candidato_monto',
  });
}

describe('RS-1 empresa vacía', () => {
  it('R1: ceros, lista vacía y solo las llaves del contrato', async () => {
    const r = await resumen();
    expect(r).toEqual({
      conteos: { conciliado: 0, sugerencia: 0, sin_match: 0 },
      montoPorRevisar: [],
    });
    expect(Object.keys(r).sort()).toEqual(['conteos', 'montoPorRevisar']);
    expect(Object.keys(r.conteos).sort()).toEqual([
      'conciliado',
      'sin_match',
      'sugerencia',
    ]);
  });
});

describe('RS-2 conteos y monto', () => {
  it('R2: cuenta por estado derivado sin duplicar por propuesta', async () => {
    await sembrarMixto(A);
    expect((await resumen()).conteos).toEqual({
      conciliado: 1,
      sugerencia: 2,
      sin_match: 3,
    });
  });

  it('R3: monto por revisar exacto, solo sugerencia y sin_match, como texto', async () => {
    await sembrarMixto(A);
    const r = await resumen();
    // 0.10 + 0.20 + 10 + 20 + 30; el conciliado de 500 no entra.
    expect(r.montoPorRevisar).toEqual([{ moneda: 'MXN', monto: '60.3000' }]);
    expect(typeof r.montoPorRevisar[0].monto).toBe('string');
  });

  it('R3: 0.10 + 0.20 da 0.3000 sin error de flotante', async () => {
    await sinMatch(A, '0.10');
    await sinMatch(A, '0.20');
    expect((await resumen()).montoPorRevisar).toEqual([
      { moneda: 'MXN', monto: '0.3000' },
    ]);
  });

  it('R3: un monto de 14 dígitos enteros no pierde precisión', async () => {
    await sinMatch(A, '99999999999999.9900');
    await sugerido(A, '0.0100');
    expect((await resumen()).montoPorRevisar).toEqual([
      { moneda: 'MXN', monto: '100000000000000.0000' },
    ]);
  });

  it('R4: una fila por moneda, ordenadas; sin pendientes no aparece', async () => {
    await movimiento(A, {
      monto: '100.50',
      moneda: 'USD',
      regla: 'sin_candidato_monto',
    });
    await movimiento(A, {
      monto: '2150.00',
      moneda: 'MXN',
      regla: 'sin_candidato_monto',
    });
    await sugerido(A, '1.25');
    // EUR solo con un conciliado: cuenta, pero no tiene monto por revisar.
    const m = await movimiento(A, {
      monto: '40.00',
      moneda: 'EUR',
      estado: 'conciliado',
    });
    await conciliacion(A, await factura(A), m, 'confirmada');
    const r = await resumen();
    expect(r.montoPorRevisar).toEqual([
      { moneda: 'MXN', monto: '2151.2500' },
      { moneda: 'USD', monto: '100.5000' },
    ]);
    expect(r.conteos).toEqual({ conciliado: 1, sugerencia: 1, sin_match: 2 });
  });
});

describe('RS-3 paridad con GET /bandeja', () => {
  it('R5: cada conteo es el total del listado de ese estado', async () => {
    await sembrarMixto(A);
    const { conteos } = await resumen();
    for (const e of ESTADOS) {
      const r = await listar(`?estado=${e}&limite=1`);
      expect(conteos[e]).toBe(r.total);
    }
    const porDefecto = await listar();
    expect(conteos.sugerencia + conteos.sin_match).toBe(porDefecto.total);
  });

  it('R6: el monto por revisar es la suma de las filas del listado', async () => {
    await sembrarMixto(A);
    await movimiento(A, {
      monto: '12.34',
      moneda: 'USD',
      regla: 'sin_candidato_monto',
    });
    await movimiento(A, {
      monto: '0.66',
      moneda: 'USD',
      regla: 'sin_candidato_monto',
    });
    const filas = (await listar('?limite=200')).datos;
    const porMoneda = new Map<string, ReturnType<typeof dinero>[]>();
    for (const f of filas) {
      porMoneda.set(f.moneda, [
        ...(porMoneda.get(f.moneda) ?? []),
        dinero(f.monto),
      ]);
    }
    const esperado = [...porMoneda.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([moneda, montos]) => ({
        moneda,
        monto: aTexto(sumar(montos), 4),
      }));
    expect(esperado.length).toBe(2);
    expect((await resumen()).montoPorRevisar).toEqual(esperado);
  });
});

describe('RS-4 aislamiento y acceso', () => {
  it('R7: cada empresa ve solo lo suyo con su propio token', async () => {
    await sinMatch(A, '10.00');
    await sinMatch(B, '1.00');
    await sinMatch(B, '2.00');
    await sugerido(B, '4.00');
    const deA = await resumen(tokenA);
    const deB = await resumen(await entorno.token(CARMEN, TRANSPORTES));
    expect(deA).toEqual({
      conteos: { conciliado: 0, sugerencia: 0, sin_match: 1 },
      montoPorRevisar: [{ moneda: 'MXN', monto: '10.0000' }],
    });
    expect(deB).toEqual({
      conteos: { conciliado: 0, sugerencia: 1, sin_match: 2 },
      montoPorRevisar: [{ moneda: 'MXN', monto: '7.0000' }],
    });
  });

  it('R8: un companyId en la query se ignora', async () => {
    await sinMatch(A, '10.00');
    await sinMatch(B, '1.00');
    await sinMatch(B, '2.00');
    const limpio = await resumen();
    const conAjeno = await resumen(tokenA, `?companyId=${B}`);
    expect(conAjeno).toEqual(limpio);
    expect(conAjeno.conteos.sin_match).toBe(1);
  });

  it('R9: admin, contador y revisor leen con su propio token', async () => {
    await sembrarMixto(A);
    await sembrarMixto(B);
    const admin = await resumen(await entorno.token(ANA, FERRETERIA));
    const contador = await resumen(await entorno.token(LUIS, FERRETERIA));
    const revisor = await resumen(await entorno.token(JORGE, TRANSPORTES));
    expect(admin.conteos.sin_match).toBe(3);
    expect(contador).toEqual(admin);
    // Mismos datos sembrados en Transportes: mismo cuerpo.
    expect(revisor).toEqual(admin);
  });

  it('R9: sin token es 401', async () => {
    await request(entorno.app.getHttpServer())
      .get('/bandeja/resumen')
      .expect(401);
  });

  it('R9: una sesión sin empresa elegida es 401', async () => {
    // Sesión abierta pero sin empresa elegida (`company_id` nulo).
    const token = await abrirSesion(entorno.ds, entorno.persona(ANA), null);
    await resumir(token).expect(401);
  });

  it('R9: sin membresía en la empresa del token es 403', async () => {
    await resumir(await entorno.token(LUIS, TRANSPORTES)).expect(403);
  });
});

describe('RS-5 solo lectura y compatibilidad', () => {
  it('R10: llamar al resumen no cambia ninguna tabla', async () => {
    await sembrarMixto(A);
    const foto = () =>
      ds.query<unknown[]>(
        `SELECT (SELECT json_agg(m ORDER BY id) FROM movimientos m) AS m,
                (SELECT json_agg(c ORDER BY id) FROM conciliaciones c) AS c`,
      );
    const antes = await foto();
    await resumen();
    await resumen();
    expect(await foto()).toEqual(antes);
  });

  it('R11: GET /bandeja sigue respondiendo con la misma forma', async () => {
    await sinMatch(A);
    const r = await listar();
    expect(Object.keys(r).sort()).toEqual([
      'datos',
      'limite',
      'pagina',
      'total',
    ]);
    expect(r.total).toBe(1);
  });
});
