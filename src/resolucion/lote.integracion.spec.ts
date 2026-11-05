import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
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
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * Historia 5.3 (FR-18, FR-19, FR-31): POST /conciliaciones/lotes confirma de una
 * vez las propuestas que la persona dejó marcadas. Contra Postgres real con RLS.
 * Los datos se preparan con la conexión del dueño; el endpoint escribe como
 * cuadra_app.
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
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, bitacora CASCADE',
  );
  jest
    .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
    .mockResolvedValue({ propuestas: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function movimiento(
  empresa: string,
  o: { monto?: string; estado?: string; cargaId?: string | null } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,$2,$3,'2026-09-02','SPEI RECIBIDO',$4,$5) RETURNING id`,
    [
      empresa,
      o.cargaId ?? null,
      linea++,
      o.monto ?? '1160.00',
      o.estado ?? 'abierto',
    ],
  );
  return id;
}

async function factura(
  empresa: string,
  o: { cargaId?: string | null; estado?: string } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,$3,$4,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             '1160.00','1160.00',$5,'PUE','{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [
      empresa,
      o.cargaId ?? null,
      randomUUID(),
      FERRETERIA,
      o.estado ?? 'abierta',
    ],
  );
  return id;
}

async function carga(empresa: string, subidoPor: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo, hash_archivo,
                         total_registros, registros_ok, subido_por_id)
     VALUES ($1,'cfdi','procesada','x',$2,1,1,$3) RETURNING id`,
    [empresa, randomUUID().replace(/-/g, '').repeat(2), subidoPor],
  );
  return id;
}

/** Una propuesta lista para confirmar, con su CFDI y su movimiento. */
async function propuesta(
  empresa = A,
  o: {
    regla?: string;
    cfdiId?: string;
    movimientoId?: string;
    cargaCfdi?: string | null;
    cargaMov?: string | null;
  } = {},
) {
  const cfdiId =
    o.cfdiId ?? (await factura(empresa, { cargaId: o.cargaCfdi ?? null }));
  const movimientoId =
    o.movimientoId ??
    (await movimiento(empresa, { cargaId: o.cargaMov ?? null }));
  const id = await sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiId,
    estado: 'propuesta',
    origen: 'regla',
    regla: o.regla ?? 'referencia_monto_exacto',
    score: '0.9500',
    diferenciaMonto: '0.0000',
    motivo: 'Motivo de propuesta',
  });
  return { id, cfdiId, movimientoId };
}

interface RespuestaLote {
  loteId: string | null;
  confirmadas: string[];
  omitidas: Array<{ id: string; razon: string }>;
}

const lote = (ids: unknown, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post('/conciliaciones/lotes')
    .set('Cookie', token)
    .send({ ids });

const cuerpo = (res: request.Response) => res.body as RespuestaLote;

const decision = (id: string) =>
  una<{
    estado: string;
    loteId: string | null;
    por: string | null;
    cuando: Date | null;
    regla: string | null;
  }>(
    ds,
    `SELECT estado, lote_id AS "loteId", confirmada_por_id AS por,
            confirmada_at AS cuando, regla
       FROM decisiones WHERE id = $1`,
    [id],
  );

const estadoDe = async (tabla: 'cfdi' | 'movimientos', id: string) =>
  (
    await una<{ estado: string }>(
      ds,
      `SELECT estado FROM ${tabla} WHERE id = $1`,
      [id],
    )
  ).estado;

const bitacoraConfirmar = (id: string) =>
  filas<{ userId: string; datos: Record<string, any> }>(
    ds,
    `SELECT user_id AS "userId", datos FROM bitacora
      WHERE entidad = 'decisiones' AND entidad_id = $1 AND accion = 'confirmar'`,
    [id],
  );

const denegados = () =>
  filas<{ datos: Record<string, unknown> }>(
    ds,
    `SELECT datos FROM bitacora WHERE accion = 'acceso_denegado'`,
  );

describe('POST /conciliaciones/lotes: confirmar lo marcado (S2, S6)', () => {
  it('confirma solo las marcadas, todas con el mismo lote_id, y deja el resto como estaba', async () => {
    const a = await propuesta();
    const b = await propuesta();
    const noMarcada = await propuesta(A, { regla: 'monto_unico' });

    const res = await lote([a.id, b.id]).expect(200);

    const r = cuerpo(res);
    expect(r.loteId).toEqual(expect.any(String));
    expect([...r.confirmadas].sort()).toEqual([a.id, b.id].sort());
    expect(r.omitidas).toEqual([]);
    const da = await decision(a.id);
    const db = await decision(b.id);
    expect(da.estado).toBe('confirmada');
    expect(db.estado).toBe('confirmada');
    expect(da.loteId).toBe(r.loteId);
    expect(db.loteId).toBe(r.loteId);
    expect((await decision(noMarcada.id)).estado).toBe('propuesta');
    expect((await decision(noMarcada.id)).loteId).toBeNull();
    expect(await estadoDe('cfdi', a.cfdiId)).toBe('conciliada');
    expect(await estadoDe('movimientos', a.movimientoId)).toBe('conciliado');
    expect(await estadoDe('movimientos', noMarcada.movimientoId)).toBe(
      'abierto',
    );
  });

  it('cada una queda con persona, fecha y regla, y el lote no pide motivo', async () => {
    const a = await propuesta(A, { regla: 'referencia_monto_exacto' });
    const b = await propuesta(A, { regla: 'monto_unico' });

    await lote([a.id, b.id]).expect(200);

    for (const [p, regla] of [
      [a, 'referencia_monto_exacto'],
      [b, 'monto_unico'],
    ] as const) {
      const d = await decision(p.id);
      expect(d.por).toBe(entorno.persona(ANA));
      expect(d.cuando).toBeInstanceOf(Date);
      expect(d.regla).toBe(regla);
    }
  });

  it('S6: una entrada de bitácora `confirmar` por decisión, con el loteId', async () => {
    const a = await propuesta();
    const b = await propuesta();
    const fuera = await propuesta();

    const r = cuerpo(await lote([a.id, b.id]).expect(200));

    for (const p of [a, b]) {
      const entradas = await bitacoraConfirmar(p.id);
      expect(entradas).toHaveLength(1);
      expect(entradas[0].userId).toBe(entorno.persona(ANA));
      expect(entradas[0].datos).toMatchObject({
        despues: { estado: 'confirmada' },
        regla: 'referencia_monto_exacto',
        loteId: r.loteId,
      });
    }
    expect(await bitacoraConfirmar(fuera.id)).toEqual([]);
  });

  it('una hermana no marcada pasa a obsoleta, igual que al confirmar un caso', async () => {
    const a = await propuesta();
    const hermana = await propuesta(A, {
      movimientoId: a.movimientoId,
      regla: 'monto_unico',
    });

    await lote([a.id]).expect(200);

    expect((await decision(hermana.id)).estado).toBe('obsoleta');
  });

  it('la confirmación individual sigue sin lote_id ni loteId en la bitácora', async () => {
    const a = await propuesta();
    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${a.id}/confirmar`)
      .set('Cookie', tokenAna)
      .send()
      .expect(200);
    expect((await decision(a.id)).loteId).toBeNull();
    const [entrada] = await bitacoraConfirmar(a.id);
    expect(entrada.datos).not.toHaveProperty('loteId');
  });
});

describe('POST /conciliaciones/lotes: omitir con su razón (S3)', () => {
  it('una que otra persona ya resolvió se omite; las demás se confirman', async () => {
    const a = await propuesta();
    const resuelta = await propuesta();
    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${resuelta.id}/rechazar`)
      .set('Cookie', await entorno.token(LUIS, FERRETERIA))
      .send({})
      .expect(200);

    const r = cuerpo(await lote([a.id, resuelta.id]).expect(200));

    expect(r.confirmadas).toEqual([a.id]);
    expect(r.omitidas).toEqual([{ id: resuelta.id, razon: 'ya_resuelta' }]);
    expect((await decision(resuelta.id)).estado).toBe('rechazada');
  });

  it('un id que no existe o es de otra empresa se omite sin revelar nada', async () => {
    const a = await propuesta();
    const ajena = await propuesta(B);
    const inexistente = randomUUID();

    const r = cuerpo(await lote([a.id, ajena.id, inexistente]).expect(200));

    expect(r.confirmadas).toEqual([a.id]);
    expect([...r.omitidas].sort((x, y) => (x.id < y.id ? -1 : 1))).toEqual(
      [
        { id: ajena.id, razon: 'no_existe' },
        { id: inexistente, razon: 'no_existe' },
      ].sort((x, y) => (x.id < y.id ? -1 : 1)),
    );
    expect((await decision(ajena.id)).estado).toBe('propuesta');
  });

  it('un CFDI o un movimiento que ya no están abiertos se omiten con su razón', async () => {
    const cfdiCerrado = await propuesta();
    const movCerrado = await propuesta();
    await ds.query(`UPDATE cfdi SET estado = 'conciliada' WHERE id = $1`, [
      cfdiCerrado.cfdiId,
    ]);
    await ds.query(
      `UPDATE movimientos SET estado = 'conciliado' WHERE id = $1`,
      [movCerrado.movimientoId],
    );
    const ok = await propuesta();

    const r = cuerpo(
      await lote([cfdiCerrado.id, movCerrado.id, ok.id]).expect(200),
    );

    expect(r.confirmadas).toEqual([ok.id]);
    const razon = (id: string) => r.omitidas.find((o) => o.id === id)?.razon;
    expect(razon(cfdiCerrado.id)).toBe('cfdi_no_abierto');
    expect(razon(movCerrado.id)).toBe('movimiento_no_abierto');
  });

  it('si todo se omite no nace ningún lote', async () => {
    const resuelta = await propuesta();
    await ds.query(`UPDATE decisiones SET estado = 'rechazada' WHERE id = $1`, [
      resuelta.id,
    ]);
    const r = cuerpo(await lote([resuelta.id]).expect(200));
    expect(r).toEqual({
      loteId: null,
      confirmadas: [],
      omitidas: [{ id: resuelta.id, razon: 'ya_resuelta' }],
    });
  });

  it('dos marcadas que chocan entre sí (mismo movimiento o misma factura) se omiten las dos', async () => {
    // Un falso positivo es peor que no conciliar: no se elige una al azar.
    const a = await propuesta();
    const mismaMov = await propuesta(A, {
      movimientoId: a.movimientoId,
      regla: 'monto_unico',
    });
    const x = await propuesta();
    const mismaFactura = await propuesta(A, {
      cfdiId: x.cfdiId,
      regla: 'monto_unico',
    });
    const libre = await propuesta();

    const r = cuerpo(
      await lote([a.id, mismaMov.id, x.id, mismaFactura.id, libre.id]).expect(
        200,
      ),
    );

    expect(r.confirmadas).toEqual([libre.id]);
    expect(r.omitidas.map((o) => o.razon)).toEqual([
      'choca_con_otra_del_lote',
      'choca_con_otra_del_lote',
      'choca_con_otra_del_lote',
      'choca_con_otra_del_lote',
    ]);
    for (const p of [a, mismaMov, x, mismaFactura]) {
      expect((await decision(p.id)).estado).toBe('propuesta');
    }
  });
});

describe('POST /conciliaciones/lotes: separación de funciones (S4)', () => {
  it('la que la persona no puede confirmar se omite aunque venga marcada, sin 403 ni acceso_denegado', async () => {
    const suya = await carga(A, entorno.persona(ANA));
    const bloqueada = await propuesta(A, { cargaCfdi: suya });
    const delMovimiento = await propuesta(A, { cargaMov: suya });
    const ok = await propuesta();

    const r = cuerpo(
      await lote([bloqueada.id, delMovimiento.id, ok.id]).expect(200),
    );

    expect(r.confirmadas).toEqual([ok.id]);
    expect(r.omitidas.map((o) => o.razon)).toEqual([
      'separacion_de_funciones',
      'separacion_de_funciones',
    ]);
    expect((await decision(bloqueada.id)).estado).toBe('propuesta');
    expect(await denegados()).toEqual([]);
  });

  it('lo que sube otra persona sí se puede confirmar', async () => {
    const deLuis = await carga(A, entorno.persona(LUIS));
    const p = await propuesta(A, { cargaCfdi: deLuis });
    const r = cuerpo(await lote([p.id]).expect(200));
    expect(r.confirmadas).toEqual([p.id]);
  });
});

describe('POST /conciliaciones/lotes: concurrencia (AD-19)', () => {
  it('dos lotes a la vez sobre las mismas propuestas: sin 500, cada una se confirma una sola vez', async () => {
    const todas: Awaited<ReturnType<typeof propuesta>>[] = [];
    for (let i = 0; i < 8; i++) todas.push(await propuesta());
    const ids = todas.map((t) => t.id);
    const otroToken = await entorno.token(LUIS, FERRETERIA);

    const [r1, r2] = await Promise.all([
      lote(ids).expect(200),
      lote([...ids].reverse(), otroToken).expect(200),
    ]);

    const a = cuerpo(r1);
    const b = cuerpo(r2);
    const confirmadas = [...a.confirmadas, ...b.confirmadas].sort();
    expect(confirmadas).toEqual([...ids].sort());
    expect(new Set(confirmadas).size).toBe(8);
    for (const lado of [a, b]) {
      expect(lado.confirmadas.length + lado.omitidas.length).toBe(8);
      for (const o of lado.omitidas) expect(o.razon).toBe('ya_resuelta');
    }
    const [{ n }] = await filas<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM bitacora WHERE accion = 'confirmar'`,
    );
    expect(n).toBe(8);
    for (const t of todas) {
      expect(await estadoDe('movimientos', t.movimientoId)).toBe('conciliado');
    }
  });

  it('un lote y la confirmación de un caso a la vez: gana uno y el otro lo omite o recibe 409', async () => {
    const a = await propuesta();
    const resultados = await Promise.all([
      lote([a.id]),
      request(entorno.app.getHttpServer())
        .post(`/conciliaciones/${a.id}/confirmar`)
        .set('Cookie', await entorno.token(LUIS, FERRETERIA))
        .send(),
    ]);
    const [porLote, individual] = resultados;
    expect(porLote.status).toBe(200);
    expect([200, 409]).toContain(individual.status);
    const ganoElLote = cuerpo(porLote).confirmadas.includes(a.id);
    expect(ganoElLote).toBe(individual.status === 409);
    const [{ n }] = await filas<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM bitacora WHERE accion = 'confirmar'`,
    );
    expect(n).toBe(1);
  });
});

describe('POST /conciliaciones/lotes: acceso y validación (S5)', () => {
  it('un auditor recibe 403, queda el acceso denegado y no cambia nada', async () => {
    const a = await propuesta();
    await ds.query(
      `UPDATE user_company_roles SET rol = 'auditor'
        WHERE user_id = $1 AND company_id = $2`,
      [entorno.persona(LUIS), A],
    );
    try {
      await lote([a.id], await entorno.token(LUIS, FERRETERIA)).expect(403);
    } finally {
      await ds.query(
        `UPDATE user_company_roles SET rol = 'contador'
          WHERE user_id = $1 AND company_id = $2`,
        [entorno.persona(LUIS), A],
      );
    }
    expect((await decision(a.id)).estado).toBe('propuesta');
    const [fila] = await denegados();
    expect(fila.datos).toMatchObject({ permiso: 'conciliaciones.resolver' });
  });

  it('sin sesión es 401', async () => {
    await request(entorno.app.getHttpServer())
      .post('/conciliaciones/lotes')
      .send({ ids: [randomUUID()] })
      .expect(401);
  });

  it.each([
    ['sin ids', undefined],
    ['una lista vacía', []],
    ['un id que no es uuid', ['no-es-uuid']],
    [
      'ids repetidos',
      [
        '11111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
      ],
    ],
    ['ids que no son texto', [1, 2]],
    ['más de 500 ids', Array.from({ length: 501 }, () => randomUUID())],
  ])('%s es 400', async (_nombre, ids) => {
    await lote(ids).expect(400);
  });

  it('exactamente 500 ids se aceptan', async () => {
    const ids = Array.from({ length: 500 }, () => randomUUID());
    const r = cuerpo(await lote(ids).expect(200));
    expect(r.omitidas).toHaveLength(500);
    expect(r.loteId).toBeNull();
  });

  it('un revisor de la empresa B no ve ni toca las propuestas de A', async () => {
    const a = await propuesta();
    const tokenCarmen = await entorno.token(CARMEN, TRANSPORTES);
    const r = cuerpo(await lote([a.id], tokenCarmen).expect(200));
    expect(r.omitidas).toEqual([{ id: a.id, razon: 'no_existe' }]);
    expect((await decision(a.id)).estado).toBe('propuesta');
    expect(JORGE).toBeDefined();
  });
});
