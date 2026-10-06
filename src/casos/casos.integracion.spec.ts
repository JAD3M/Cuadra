import { randomUUID } from 'crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
import type { RespuestaBandejaDto } from '../bandeja/dto/bandeja.dto';
import type { RespuestaCasoDto } from './dto/caso.dto';

/**
 * CU-23 de punta a punta contra Postgres real con RLS: el detalle del caso
 * (GET /casos/:movimientoId). Los datos se preparan con la conexión del
 * dueño; el endpoint lee como cuadra_app.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenA: string;
let linea = 0;
let toleranciasOriginales: { id: string; tolerancia: string }[] = [];

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenA = await entorno.token(ANA, FERRETERIA);
  // La tolerancia es de la empresa: se fija en 0.5000 y se restaura al salir.
  toleranciasOriginales = await ds.query(
    `SELECT id, tolerancia_monto::text AS tolerancia FROM companies`,
  );
  await ds.query(`UPDATE companies SET tolerancia_monto = '0.5000'`);
}, 60_000);

afterAll(async () => {
  for (const { id, tolerancia } of toleranciasOriginales) {
    await ds?.query(
      `UPDATE companies SET tolerancia_monto = $2 WHERE id = $1`,
      [id, tolerancia],
    );
  }
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

async function factura(
  empresa: string,
  o: { total?: string; opcionales?: boolean } = {},
): Promise<string> {
  const total = o.total ?? '1160.00';
  const completa = o.opcionales !== true;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       nombre_emisor, nombre_receptor, fecha_emision, tipo_comprobante,
                       moneda, subtotal, total, estado, metodo_pago, xml_raw)
     VALUES ($1,$2,'AAA010101AAA','XAXX010101000',
             CASE WHEN $4::boolean THEN 'A' END, CASE WHEN $4::boolean THEN '1001' END,
             CASE WHEN $4::boolean THEN 'Emisor SA' END,
             CASE WHEN $4::boolean THEN 'Receptor SA' END,
             '2026-09-01T10:00:00','I','MXN',$3,$3,'abierta',
             CASE WHEN $4::boolean THEN 'PUE' END, '{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), total, completa],
  );
  return id;
}

async function conciliacion(
  empresa: string,
  cfdiId: string,
  movimientoId: string,
  estado: 'propuesta' | 'rechazada' | 'confirmada',
  o: {
    score?: string | null;
    regla?: string;
    origen?: 'regla' | 'llm' | 'manual';
    diferencia?: string;
    confirmo?: string;
  } = {},
): Promise<string> {
  const persona =
    estado === 'confirmada' ? entorno.persona(o.confirmo ?? ANA) : null;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, regla, score,
                                 diferencia_monto, motivo, confirmada_por_id, confirmada_at)
     VALUES ($1,$2,$3,$4::text,$9,$5,$6,$7,'Motivo de ' || $4::text,$8,
             CASE WHEN $8::uuid IS NULL THEN NULL ELSE now() END)
     RETURNING id`,
    [
      empresa,
      cfdiId,
      movimientoId,
      estado,
      o.regla ?? 'monto_unico',
      o.score === undefined ? '0.9000' : o.score,
      o.diferencia ?? '0.0000',
      persona,
      o.origen ?? 'regla',
    ],
  );
  return id;
}

const caso = (token: string, id: string, query = '') =>
  request(entorno.app.getHttpServer())
    .get(`/casos/${id}${query}`)
    .auth(token, { type: 'bearer' });

async function obtener(id: string, token = tokenA): Promise<RespuestaCasoDto> {
  const res = await caso(token, id).expect(200);
  return res.body as RespuestaCasoDto;
}

describe('CAS-1 endpoint, acceso y validación del id', () => {
  it('admin, contador y revisor, cada uno con su propio token, reciben cuerpos idénticos', async () => {
    const m = await movimiento(A);
    await conciliacion(A, await factura(A), m, 'propuesta');
    const admin = await obtener(m, await entorno.token(ANA, FERRETERIA));
    const contador = await obtener(m, await entorno.token(LUIS, FERRETERIA));
    // JORGE es revisor en Transportes: su caso vive en B.
    const mB = await movimiento(B);
    await conciliacion(B, await factura(B), mB, 'propuesta');
    const revisor = await obtener(mB, await entorno.token(JORGE, TRANSPORTES));
    expect(contador).toEqual(admin);
    expect(revisor.estado).toBe('sugerencia');
    expect(revisor.propuestas).toHaveLength(1);
  });

  it('un id que no es UUID es 400', async () => {
    await caso(tokenA, '42').expect(400);
  });

  it('sin token es 401', async () => {
    await request(entorno.app.getHttpServer())
      .get(`/casos/${randomUUID()}`)
      .expect(401);
  });

  it('un token de selección de empresa es 401', async () => {
    const jwt = new JwtService({
      secret: entorno.app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
    });
    const token = await jwt.signAsync(
      { sub: entorno.persona(ANA), scope: 'seleccion' },
      { expiresIn: '5m' },
    );
    await caso(token, randomUUID()).expect(401);
  });

  it('el companyId de la query se ignora: el movimiento de B con la sesión de A es 404', async () => {
    const mB = await movimiento(B);
    await caso(tokenA, mB, `?companyId=${B}`).expect(404);
  });
});

describe('CAS-2 alcance por empresa y solo lectura', () => {
  it('el movimiento de otra empresa da el mismo 404 que un UUID al azar', async () => {
    const mB = await movimiento(B);
    await conciliacion(B, await factura(B), mB, 'propuesta');
    const ajeno = await caso(tokenA, mB).expect(404);
    const azar = await caso(tokenA, randomUUID()).expect(404);
    expect(ajeno.body).toEqual(azar.body);
  });

  it('con propuestas en dos empresas, A no ve nada de B', async () => {
    const mA = await movimiento(A);
    await conciliacion(A, await factura(A), mA, 'propuesta');
    const mB = await movimiento(B, { monto: '777.00' });
    const cfdiB = await factura(B, { total: '777.00' });
    await conciliacion(B, cfdiB, mB, 'confirmada', { confirmo: CARMEN });
    await ds.query(
      `UPDATE companies SET tolerancia_monto = '3.0000' WHERE id = $1`,
      [B],
    );
    try {
      const r = await obtener(mA);
      const texto = JSON.stringify(r);
      expect(texto).not.toContain(cfdiB);
      expect(texto).not.toContain(mB);
      expect(texto).not.toContain('777.0000');
      expect(texto).not.toContain('Carmen');
      expect(r.toleranciaMonto).toBe('0.5000');
    } finally {
      await ds.query(
        `UPDATE companies SET tolerancia_monto = '0.5000' WHERE id = $1`,
        [B],
      );
    }
  });

  it('la lectura no escribe: filas y updated_at idénticos tras tres llamadas (users no tiene company_id: se alcanza por la conciliación filtrada, B7)', async () => {
    const m = await movimiento(A);
    await conciliacion(A, await factura(A), m, 'propuesta');
    const instantanea = async () => {
      const tablas = ['movimientos', 'conciliaciones', 'cfdi'];
      const huellas: string[] = [];
      for (const t of tablas) {
        const { h } = await una<{ h: string }>(
          ds,
          `SELECT count(*)::text || ':' || coalesce(md5(string_agg(x::text, ',' ORDER BY x.id)), '') AS h
             FROM ${t} x`,
        );
        huellas.push(h);
      }
      const { n } = await una<{ n: string }>(
        ds,
        `SELECT count(*)::text AS n FROM bitacora`,
      );
      return [...huellas, n];
    };
    const antes = await instantanea();
    await obtener(m);
    await obtener(m);
    await obtener(m);
    expect(await instantanea()).toEqual(antes);
  });
});

describe('CAS-3 forma de la respuesta', () => {
  it('tres propuestas (0.9, 0.7, null) y una rechazada: orden por score con nulos al final, sin la rechazada', async () => {
    const m = await movimiento(A);
    const c07 = await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.7000',
    });
    const cNulo = await conciliacion(A, await factura(A), m, 'propuesta', {
      score: null,
    });
    const c09 = await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.9000',
    });
    await conciliacion(A, await factura(A), m, 'rechazada', { score: '0.99' });
    const r = await obtener(m);
    expect(r.estado).toBe('sugerencia');
    expect(r.propuestas.map((p) => p.conciliacionId)).toEqual([
      c09,
      c07,
      cNulo,
    ]);
    expect(r.propuestas.map((p) => p.score)).toEqual([
      '0.9000',
      '0.7000',
      null,
    ]);
    expect(r.sinMatch).toBeNull();
  });

  it('la primera propuesta es la mejorPropuesta de la bandeja, y el empate de score lo rompe el id', async () => {
    const m = await movimiento(A);
    await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.8000',
    });
    await conciliacion(A, await factura(A), m, 'propuesta', {
      score: '0.8000',
    });
    const r = await obtener(m);
    const lista = await request(entorno.app.getHttpServer())
      .get('/bandeja')
      .auth(tokenA, { type: 'bearer' })
      .expect(200);
    const fila = (lista.body as RespuestaBandejaDto).datos.find(
      (f) => f.movimientoId === m,
    );
    expect(r.propuestas[0].conciliacionId).toBe(
      fila?.mejorPropuesta?.conciliacionId,
    );
    const ids = r.propuestas.map((p) => p.conciliacionId);
    expect(ids).toEqual([...ids].sort());
  });

  it('un conciliado con una confirmada y dos rechazadas devuelve solo la confirmada, con confirmadaAt ISO y quien la confirmó', async () => {
    const m = await movimiento(A, { estado: 'conciliado' });
    const confirmada = await conciliacion(A, await factura(A), m, 'confirmada');
    await conciliacion(A, await factura(A), m, 'rechazada');
    await conciliacion(A, await factura(A), m, 'rechazada');
    const r = await obtener(m);
    expect(r.estado).toBe('conciliado');
    expect(r.propuestas).toHaveLength(1);
    const [p] = r.propuestas;
    expect(p.conciliacionId).toBe(confirmada);
    expect(p.estado).toBe('confirmada');
    expect(p.confirmadaAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(p.confirmadaPor?.nombre).toEqual(expect.any(String));
    expect(r.sinMatch).toBeNull();
  });

  it('un sin_match con regla y motivo guardados los devuelve y no trae propuestas', async () => {
    const m = await movimiento(A, { regla: 'sin_candidato_monto' });
    await conciliacion(A, await factura(A), m, 'rechazada');
    const r = await obtener(m);
    expect(r.estado).toBe('sin_match');
    expect(r.propuestas).toEqual([]);
    expect(r.sinMatch).toEqual({
      regla: 'sin_candidato_monto',
      motivo: 'Motivo guardado',
    });
  });

  it('un abierto sin evaluar es 200 sin_match con sinMatch en null', async () => {
    const m = await movimiento(A);
    const r = await obtener(m);
    expect(r.estado).toBe('sin_match');
    expect(r.propuestas).toEqual([]);
    expect(r.sinMatch).toEqual({ regla: null, motivo: null });
  });

  it('un monto no positivo y un descartado son 200 con su estado guardado y sin propuestas inventadas', async () => {
    const cargo = await movimiento(A, { monto: '-500.00' });
    await conciliacion(A, await factura(A), cargo, 'rechazada');
    const descartado = await movimiento(A, {
      estado: 'descartado',
      regla: 'sin_candidato_monto',
    });
    // Una propuesta vigente sobre un descartado no debe asomar en el caso.
    await conciliacion(A, await factura(A), descartado, 'propuesta');
    const rCargo = await obtener(cargo);
    expect(rCargo.movimiento.estado).toBe('abierto');
    expect(rCargo.propuestas).toEqual([]);
    const rDescartado = await obtener(descartado);
    expect(rDescartado.movimiento.estado).toBe('descartado');
    expect(rDescartado.propuestas).toEqual([]);
    expect(rDescartado.estado).toBe('sin_match');
    expect(rDescartado.sinMatch).toEqual({ regla: null, motivo: null });
  });

  it('un CFDI sin serie, folio, emisor, receptor ni método de pago trae esas llaves en null', async () => {
    const m = await movimiento(A, { referencia: 'REF-9' });
    await conciliacion(
      A,
      await factura(A, { opcionales: true }),
      m,
      'propuesta',
    );
    const r = await obtener(m);
    expect(r.movimiento.referencia).toBe('REF-9');
    const { cfdi } = r.propuestas[0];
    for (const llave of [
      'serie',
      'folio',
      'nombreEmisor',
      'nombreReceptor',
      'metodoPago',
    ] as const) {
      expect(cfdi).toHaveProperty(llave, null);
    }
  });

  it('origen viaja para propuestas de regla y de llm (B3)', async () => {
    const m = await movimiento(A);
    await conciliacion(A, await factura(A), m, 'propuesta', {
      origen: 'regla',
      score: '0.9000',
    });
    await conciliacion(A, await factura(A), m, 'propuesta', {
      origen: 'llm',
      regla: 'llm_sugerencia',
      score: '0.5000',
    });
    const r = await obtener(m);
    expect(r.propuestas.map((p) => p.origen)).toEqual(['regla', 'llm']);
  });
});

describe('CAS-4 montos como cadenas decimales exactas', () => {
  it('conserva el máximo de numeric(18,4) y una diferencia negativa pequeña como texto (B1)', async () => {
    const m = await movimiento(A, { monto: '99999999999999.9999' });
    await conciliacion(
      A,
      await factura(A, { total: '99999999999999.9999' }),
      m,
      'propuesta',
      { diferencia: '-0.0040' },
    );
    const r = await obtener(m);
    expect(r.movimiento.monto).toBe('99999999999999.9999');
    expect(r.propuestas[0].diferenciaMonto).toBe('-0.0040');
    expect(r.propuestas[0].cfdi.total).toBe('99999999999999.9999');
    for (const valor of [
      r.movimiento.monto,
      r.toleranciaMonto,
      r.propuestas[0].diferenciaMonto,
      r.propuestas[0].cfdi.total,
      r.propuestas[0].score,
    ]) {
      expect(typeof valor).toBe('string');
    }
  });

  it('la tolerancia es "0.5000" en todos los estados del caso', async () => {
    const sugerencia = await movimiento(A, { monto: '10.00' });
    await conciliacion(
      A,
      await factura(A, { total: '10.00' }),
      sugerencia,
      'propuesta',
    );
    const sinMatch = await movimiento(A, { regla: 'sin_candidato_monto' });
    const conciliado = await movimiento(A, { estado: 'conciliado' });
    await conciliacion(A, await factura(A), conciliado, 'confirmada');
    const vacio = await movimiento(A);
    for (const id of [sugerencia, sinMatch, conciliado, vacio]) {
      expect((await obtener(id)).toleranciaMonto).toBe('0.5000');
    }
  });
});

describe('CAS-5 documentación', () => {
  it('OpenAPI incluye GET /casos/{movimientoId} con 200 tipado y 400, 401, 404', () => {
    const documento = SwaggerModule.createDocument(
      entorno.app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const operacion = documento.paths['/casos/{movimientoId}']?.get;
    expect(operacion).toBeDefined();
    expect(Object.keys(operacion?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '400', '401', '404']),
    );
    const ok = operacion?.responses['200'] as {
      content: Record<string, { schema: { $ref: string } }>;
    };
    expect(ok.content['application/json'].schema.$ref).toContain(
      'RespuestaCasoDto',
    );
  });
});
