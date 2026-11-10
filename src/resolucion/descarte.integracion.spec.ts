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

/**
 * Historia 5.6 (FR-21) de punta a punta contra Postgres real con RLS:
 * POST /movimientos/:id/descartar y /deshacer-descarte.
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

async function movimiento(empresa: string, estado = 'abierto') {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,NULL,$2,'2026-09-02','COMISION',$3,$4) RETURNING id`,
    [empresa, linea++, '-35.00', estado],
  );
  return id;
}

async function factura(empresa: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,NULL,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             100,100,'abierta','PUE','{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [empresa, randomUUID(), FERRETERIA],
  );
  return id;
}

const descartar = (id: string, token = tokenAna, cuerpo: object = {}) =>
  request(entorno.app.getHttpServer())
    .post(`/movimientos/${id}/descartar`)
    .set('Cookie', token)
    .send(cuerpo);

const deshacer = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/movimientos/${id}/deshacer-descarte`)
    .set('Cookie', token)
    .send();

const estadoMovimiento = async (id: string) =>
  (
    await una<{ estado: string }>(
      ds,
      'SELECT estado FROM movimientos WHERE id = $1',
      [id],
    )
  ).estado;

const bitacora = (accion: string) =>
  filas<{
    user_id: string;
    entidad: string;
    datos: Record<string, unknown>;
    created_at: Date;
  }>(
    ds,
    `SELECT user_id, entidad, datos, created_at FROM bitacora WHERE accion = $1`,
    [accion],
  );

describe('POST /movimientos/:id/descartar', () => {
  it('crea la decisión de descarte, saca el movimiento y deja la bitácora con persona, fecha y motivo', async () => {
    const id = await movimiento(A);

    const res = await descartar(id, tokenAna, {
      motivo: '  Comisión bancaria  ',
    }).expect(200);

    expect(res.body).toEqual({
      id: expect.any(String) as string,
      movimientoId: id,
      estado: 'descartada',
      motivo: 'Comisión bancaria',
    });
    expect(await estadoMovimiento(id)).toBe('descartado');
    const decision = await una<{
      tipo: string;
      estado: string;
      origen: string;
      motivo: string;
      descartada_por_id: string;
    }>(
      ds,
      `SELECT tipo, estado, origen, motivo, descartada_por_id
         FROM decisiones WHERE movimiento_id = $1`,
      [id],
    );
    expect(decision).toEqual({
      tipo: 'descarte',
      estado: 'descartada',
      origen: 'manual',
      motivo: 'Comisión bancaria',
      descartada_por_id: entorno.persona(ANA),
    });
    const [auditoria, ...resto] = await bitacora('descartar');
    expect(resto).toHaveLength(0);
    expect(auditoria.user_id).toBe(entorno.persona(ANA));
    expect(auditoria.entidad).toBe('decisiones');
    expect(auditoria.created_at).toBeInstanceOf(Date);
    expect(auditoria.datos).toMatchObject({
      movimientoId: id,
      motivo: 'Comisión bancaria',
      despues: { estado: 'descartada' },
    });
  });

  it('el movimiento descartado sale de la bandeja', async () => {
    const id = await movimiento(A);
    await descartar(id).send({ motivo: 'Interés' }).expect(200);

    const res = await request(entorno.app.getHttpServer())
      .get('/bandeja')
      .set('Cookie', tokenAna)
      .expect(200);

    expect(JSON.stringify(res.body)).not.toContain(id);
  });

  it.each([{}, { motivo: '' }, { motivo: '   ' }, { motivo: 42 }])(
    'sin motivo válido (%j) responde 400 y no escribe nada',
    async (cuerpo) => {
      const id = await movimiento(A);

      await descartar(id, tokenAna, cuerpo).expect(400);

      expect(await estadoMovimiento(id)).toBe('abierto');
      expect(await filas(ds, 'SELECT 1 FROM decisiones')).toHaveLength(0);
      expect(await bitacora('descartar')).toHaveLength(0);
    },
  );

  it('descartar un descartado responde 409 y no duplica', async () => {
    const id = await movimiento(A);
    await descartar(id, tokenAna, { motivo: 'Interés' }).expect(200);

    await descartar(id, tokenAna, { motivo: 'Otra vez' }).expect(409);

    expect(
      await filas(ds, `SELECT 1 FROM decisiones WHERE tipo = 'descarte'`),
    ).toHaveLength(1);
    expect(await bitacora('descartar')).toHaveLength(1);
  });

  it('un movimiento conciliado (decisión vigente) responde 409', async () => {
    const id = await movimiento(A, 'conciliado');
    const cfdiId = await factura(A);
    await sembrarDecision(ds, {
      companyId: A,
      movimientoId: id,
      cfdiId,
      estado: 'confirmada',
      confirmadaPorId: entorno.persona(ANA),
    });

    await descartar(id, tokenAna, { motivo: 'Interés' }).expect(409);

    expect(await estadoMovimiento(id)).toBe('conciliado');
    expect(await bitacora('descartar')).toHaveLength(0);
  });

  it('un movimiento de otra empresa responde 404', async () => {
    const ajeno = await movimiento(B);

    await descartar(ajeno, tokenAna, { motivo: 'Interés' }).expect(404);

    expect(await estadoMovimiento(ajeno)).toBe('abierto');
  });

  it('las propuestas del movimiento no se muestran mientras siga descartado', async () => {
    const id = await movimiento(A);
    const cfdiId = await factura(A);
    await sembrarDecision(ds, {
      companyId: A,
      movimientoId: id,
      cfdiId,
      estado: 'propuesta',
      origen: 'regla',
      regla: 'monto_unico',
      score: '0.9000',
    });
    await descartar(id, tokenAna, { motivo: 'Interés' }).expect(200);

    const res = await request(entorno.app.getHttpServer())
      .get(`/casos/${id}`)
      .set('Cookie', tokenAna);

    expect(JSON.stringify(res.body)).not.toContain(cfdiId);
  });
});

describe('POST /movimientos/:id/deshacer-descarte', () => {
  it('quien descartó lo deshace: la decisión pasa a reabierta y el movimiento vuelve a abierto', async () => {
    const id = await movimiento(A);
    await descartar(id, tokenLuis, { motivo: 'Interés' }).expect(200);

    const res = await deshacer(id, tokenLuis).expect(200);

    expect(res.body).toEqual({
      id: expect.any(String) as string,
      movimientoId: id,
      estado: 'reabierta',
      motivo: 'Interés',
    });
    expect(await estadoMovimiento(id)).toBe('abierto');
    const { estado } = await una<{ estado: string }>(
      ds,
      `SELECT estado FROM decisiones WHERE movimiento_id = $1`,
      [id],
    );
    expect(estado).toBe('reabierta');
    const [auditoria, ...resto] = await bitacora('deshacer_descarte');
    expect(resto).toHaveLength(0);
    expect(auditoria.user_id).toBe(entorno.persona(LUIS));
    expect(auditoria.datos).toMatchObject({
      movimientoId: id,
      motivo: 'Interés',
      despues: { estado: 'reabierta' },
    });
  });

  it('un admin deshace el descarte de otra persona', async () => {
    const id = await movimiento(A);
    await descartar(id, tokenLuis, { motivo: 'Interés' }).expect(200);

    await deshacer(id, tokenAna).expect(200);

    expect(await estadoMovimiento(id)).toBe('abierto');
  });

  it('otra persona sin ese permiso recibe 403, queda acceso_denegado y no cambia nada', async () => {
    const id = await movimiento(A);
    await descartar(id, tokenAna, { motivo: 'Interés' }).expect(200);

    await deshacer(id, tokenLuis).expect(403);

    expect(await estadoMovimiento(id)).toBe('descartado');
    expect(await bitacora('deshacer_descarte')).toHaveLength(0);
    expect(await bitacora('acceso_denegado')).toHaveLength(1);
  });

  it('un movimiento que no está descartado responde 409', async () => {
    const id = await movimiento(A);

    await deshacer(id).expect(409);

    expect(await estadoMovimiento(id)).toBe('abierto');
  });

  it('se puede descartar de nuevo tras deshacer y la historia queda en dos decisiones', async () => {
    const id = await movimiento(A);
    await descartar(id, tokenAna, { motivo: 'Primera' }).expect(200);
    await deshacer(id, tokenAna).expect(200);

    await descartar(id, tokenAna, { motivo: 'Segunda' }).expect(200);

    const decisiones = await filas<{ estado: string }>(
      ds,
      `SELECT estado FROM decisiones WHERE movimiento_id = $1 ORDER BY estado`,
      [id],
    );
    expect(decisiones.map((d) => d.estado)).toEqual([
      'descartada',
      'reabierta',
    ]);
  });
});
