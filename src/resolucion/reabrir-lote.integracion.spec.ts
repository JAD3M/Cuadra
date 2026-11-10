import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';
import type { ReabrirLoteRespuestaDto } from './dto/reabrir.dto';

/**
 * Historia 5.8 (FR-32, FR-33) de punta a punta contra Postgres real con RLS:
 * POST /conciliaciones/lotes/:loteId/reabrir.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenAna: string;
let tokenLuis: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenAna = await entorno.token(ANA, FERRETERIA);
  tokenLuis = await entorno.token(LUIS, FERRETERIA);
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

async function movimiento(empresa: string, estado: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,NULL,$2,'2026-09-02','SPEI RECIBIDO','1160.00',$3) RETURNING id`,
    [empresa, linea++, estado],
  );
  return id;
}

async function factura(empresa: string, estado: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,NULL,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             1160,1160,$4,'PUE','{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [empresa, randomUUID(), FERRETERIA, estado],
  );
  return id;
}

/** Una confirmación del lote `loteId`, hecha por `confirmo`. */
async function confirmadaEnLote(
  loteId: string,
  o: { empresa?: string; confirmo?: string } = {},
) {
  const empresa = o.empresa ?? A;
  const cfdiId = await factura(empresa, 'conciliada');
  const movimientoId = await movimiento(empresa, 'conciliado');
  const id = await sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiId,
    estado: 'confirmada',
    origen: 'regla',
    regla: 'monto_unico',
    score: '0.9000',
    diferenciaMonto: '0.0000',
    confirmadaPorId: entorno.persona(o.confirmo ?? LUIS),
  });
  await ds.query('UPDATE decisiones SET lote_id = $2 WHERE id = $1', [
    id,
    loteId,
  ]);
  return { id, cfdiId, movimientoId };
}

const reabrirLote = (
  loteId: string,
  token = tokenAna,
  cuerpo: object = { motivo: 'Error general' },
) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/lotes/${loteId}/reabrir`)
    .set('Cookie', token)
    .send(cuerpo);

const estadoDe = async (
  tabla: 'cfdi' | 'movimientos' | 'decisiones',
  id: string,
) =>
  (
    await una<{ estado: string }>(
      ds,
      `SELECT estado FROM ${tabla} WHERE id = $1`,
      [id],
    )
  ).estado;

const bitacora = (accion: string) =>
  filas<{
    user_id: string;
    entidad_id: string;
    datos: Record<string, unknown>;
  }>(
    ds,
    `SELECT user_id, entidad_id, datos FROM bitacora WHERE accion = $1 ORDER BY entidad_id`,
    [accion],
  );

describe('POST /conciliaciones/lotes/:loteId/reabrir', () => {
  it('reabre todo el lote con un solo motivo y deja una entrada de bitácora por caso con el loteId', async () => {
    const lote = randomUUID();
    const casos = [
      await confirmadaEnLote(lote),
      await confirmadaEnLote(lote),
      await confirmadaEnLote(lote),
    ];

    const res = await reabrirLote(lote, tokenLuis, {
      motivo: '  Confirmé el lote equivocado  ',
    }).expect(200);

    const cuerpo = res.body as ReabrirLoteRespuestaDto;
    expect(cuerpo.loteId).toBe(lote);
    expect(cuerpo.omitidas).toEqual([]);
    expect(cuerpo.reabiertas).toEqual(casos.map((c) => c.id).sort());
    for (const c of casos) {
      expect(await estadoDe('decisiones', c.id)).toBe('reabierta');
      expect(await estadoDe('cfdi', c.cfdiId)).toBe('abierta');
      expect(await estadoDe('movimientos', c.movimientoId)).toBe('abierto');
    }
    const auditoria = await bitacora('reabrir');
    expect(auditoria).toHaveLength(3);
    expect(auditoria.map((a) => a.entidad_id)).toEqual(
      casos.map((c) => c.id).sort(),
    );
    for (const a of auditoria) {
      expect(a.user_id).toBe(entorno.persona(LUIS));
      expect(a.datos).toMatchObject({
        motivo: 'Confirmé el lote equivocado',
        loteId: lote,
        antes: { estado: 'confirmada' },
        despues: { estado: 'reabierta' },
      });
    }
  });

  it('un admin reabre el lote que confirmó otra persona', async () => {
    const lote = randomUUID();
    const { id } = await confirmadaEnLote(lote, { confirmo: LUIS });

    await reabrirLote(lote, tokenAna).expect(200);

    expect(await estadoDe('decisiones', id)).toBe('reabierta');
  });

  it('quien no confirmó el lote recibe 403, queda acceso_denegado y no cambia nada', async () => {
    const lote = randomUUID();
    const { id, movimientoId } = await confirmadaEnLote(lote, {
      confirmo: ANA,
    });

    await reabrirLote(lote, tokenLuis).expect(403);

    expect(await estadoDe('decisiones', id)).toBe('confirmada');
    expect(await estadoDe('movimientos', movimientoId)).toBe('conciliado');
    expect(await bitacora('reabrir')).toHaveLength(0);
    expect(await bitacora('acceso_denegado')).toHaveLength(1);
  });

  it('un lote con confirmaciones de dos personas no lo reabre quien solo confirmó una (403, sin efecto parcial)', async () => {
    const lote = randomUUID();
    const propia = await confirmadaEnLote(lote, { confirmo: LUIS });
    await confirmadaEnLote(lote, { confirmo: ANA });

    await reabrirLote(lote, tokenLuis).expect(403);

    expect(await estadoDe('decisiones', propia.id)).toBe('confirmada');
    expect(await bitacora('reabrir')).toHaveLength(0);
  });

  it.each([{}, { motivo: '' }, { motivo: '   ' }, { motivo: 42 }])(
    'sin motivo válido (%j) responde 400 y no escribe nada',
    async (cuerpo) => {
      const lote = randomUUID();
      const { id } = await confirmadaEnLote(lote);

      await reabrirLote(lote, tokenAna, cuerpo).expect(400);

      expect(await estadoDe('decisiones', id)).toBe('confirmada');
      expect(await bitacora('reabrir')).toHaveLength(0);
    },
  );

  it('un lote inexistente o de otra empresa responde 404', async () => {
    const lote = randomUUID();
    await confirmadaEnLote(lote, { empresa: B });

    await reabrirLote(lote).expect(404);
    await reabrirLote(randomUUID()).expect(404);
  });

  it('omite las que ya se reabrieron o se reconfirmaron e informa por qué, y reabre las demás', async () => {
    const lote = randomUUID();
    const vigente = await confirmadaEnLote(lote);
    const yaReabierta = await confirmadaEnLote(lote);
    const reconfirmada = await confirmadaEnLote(lote);
    for (const c of [yaReabierta, reconfirmada]) {
      await ds.query(
        `UPDATE decisiones SET estado = 'reabierta' WHERE id = $1`,
        [c.id],
      );
    }
    // La reconfirmación es una decisión nueva sobre el mismo movimiento.
    await sembrarDecision(ds, {
      companyId: A,
      movimientoId: reconfirmada.movimientoId,
      cfdiId: await factura(A, 'conciliada'),
      estado: 'confirmada',
      confirmadaPorId: entorno.persona(LUIS),
    });

    const res = await reabrirLote(lote, tokenLuis).expect(200);

    const cuerpo = res.body as ReabrirLoteRespuestaDto;
    expect(cuerpo.reabiertas).toEqual([vigente.id]);
    expect(
      [...cuerpo.omitidas].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(
      [
        { id: yaReabierta.id, razon: 'ya_reabierta' },
        { id: reconfirmada.id, razon: 'reconfirmada' },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(await bitacora('reabrir')).toHaveLength(1);
    expect(await estadoDe('decisiones', vigente.id)).toBe('reabierta');
  });

  it('un lote sin nada que reabrir responde 200 con todo omitido y sin escribir', async () => {
    const lote = randomUUID();
    const { id } = await confirmadaEnLote(lote);
    await ds.query(`UPDATE decisiones SET estado = 'reabierta' WHERE id = $1`, [
      id,
    ]);

    const res = await reabrirLote(lote).expect(200);

    expect(res.body).toEqual({
      loteId: lote,
      reabiertas: [],
      omitidas: [{ id, razon: 'ya_reabierta' }],
    });
    expect(await bitacora('reabrir')).toHaveLength(0);
  });

  it('una falla a la mitad no reabre ningún caso del lote ni escribe bitácora (409)', async () => {
    const lote = randomUUID();
    const casos = [
      await confirmadaEnLote(lote),
      await confirmadaEnLote(lote),
      await confirmadaEnLote(lote),
    ];
    // Estado inconsistente en el caso del medio: su movimiento no está conciliado.
    const medio = [...casos].sort((a, b) => a.id.localeCompare(b.id))[1];
    await ds.query(`UPDATE movimientos SET estado = 'abierto' WHERE id = $1`, [
      medio.movimientoId,
    ]);

    const res = await reabrirLote(lote).expect(409);

    expect(JSON.stringify(res.body)).toContain('ningún caso');
    for (const c of casos) {
      expect(await estadoDe('decisiones', c.id)).toBe('confirmada');
      expect(await estadoDe('cfdi', c.cfdiId)).toBe('conciliada');
    }
    expect(await bitacora('reabrir')).toHaveLength(0);
  });

  it('dos reaperturas del mismo lote a la vez: una reabre todo y la otra omite todo, sin 500', async () => {
    const lote = randomUUID();
    await confirmadaEnLote(lote);
    await confirmadaEnLote(lote);

    const resultados = await Promise.all([
      reabrirLote(lote),
      reabrirLote(lote),
    ]);

    expect(resultados.map((r) => r.status)).toEqual([200, 200]);
    const reabiertas = resultados.map(
      (r) => (r.body as ReabrirLoteRespuestaDto).reabiertas.length,
    );
    expect(reabiertas.sort()).toEqual([0, 2]);
    expect(await bitacora('reabrir')).toHaveLength(2);
  });

  it('el lote contra la reapertura de uno de sus casos a la vez: cada decisión se reabre una sola vez', async () => {
    const lote = randomUUID();
    const a = await confirmadaEnLote(lote);
    await confirmadaEnLote(lote);

    const resultados = await Promise.all([
      reabrirLote(lote),
      request(entorno.app.getHttpServer())
        .post(`/conciliaciones/${a.id}/reabrir`)
        .set('Cookie', tokenAna)
        .send({ motivo: 'Solo este' }),
    ]);

    for (const r of resultados) expect([200, 409]).toContain(r.status);
    expect(await bitacora('reabrir')).toHaveLength(2);
    expect(await estadoDe('decisiones', a.id)).toBe('reabierta');
  });
});
