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
 * Historia 5.7 (FR-26 a FR-30) de punta a punta contra Postgres real con RLS:
 * POST /conciliaciones/:id/reabrir.
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

/** Una confirmación hecha por `confirmo`, con su CFDI conciliado y su movimiento conciliado. */
async function confirmada(
  o: { empresa?: string; confirmo?: string; cfdi?: string } = {},
) {
  const empresa = o.empresa ?? A;
  const cfdiId = await factura(empresa, o.cfdi ?? 'conciliada');
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
    motivo: 'Motivo de la propuesta',
    confirmadaPorId: entorno.persona(o.confirmo ?? LUIS),
  });
  return { id, cfdiId, movimientoId };
}

const reabrir = (
  id: string,
  token = tokenAna,
  cuerpo: object = { motivo: 'Error' },
) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/reabrir`)
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
    entidad: string;
    entidad_id: string;
    datos: Record<string, unknown>;
    created_at: Date;
  }>(
    ds,
    `SELECT user_id, entidad, entidad_id, datos, created_at FROM bitacora WHERE accion = $1`,
    [accion],
  );

describe('POST /conciliaciones/:id/reabrir', () => {
  it('quien confirmó la reabre: decisión reabierta, factura y movimiento abiertos, y la bitácora con persona, fecha y motivo', async () => {
    const { id, cfdiId, movimientoId } = await confirmada({ confirmo: LUIS });

    const res = await reabrir(id, tokenLuis, {
      motivo: '  Confirmé el CFDI equivocado  ',
    }).expect(200);

    expect(res.body).toEqual({
      id,
      estado: 'reabierta',
      movimientoId,
      cfdiIds: [cfdiId],
      motivo: 'Confirmé el CFDI equivocado',
    });
    expect(await estadoDe('decisiones', id)).toBe('reabierta');
    expect(await estadoDe('cfdi', cfdiId)).toBe('abierta');
    expect(await estadoDe('movimientos', movimientoId)).toBe('abierto');
    const lineas = await filas<{ estado_decision: string; vigente: boolean }>(
      ds,
      'SELECT estado_decision, vigente FROM decision_lineas WHERE decision_id = $1',
      [id],
    );
    expect(lineas).toEqual([{ estado_decision: 'reabierta', vigente: false }]);
    const [auditoria, ...resto] = await bitacora('reabrir');
    expect(resto).toHaveLength(0);
    expect(auditoria.user_id).toBe(entorno.persona(LUIS));
    expect(auditoria.entidad).toBe('decisiones');
    expect(auditoria.entidad_id).toBe(id);
    expect(auditoria.created_at).toBeInstanceOf(Date);
    expect(auditoria.datos).toMatchObject({
      motivo: 'Confirmé el CFDI equivocado',
      antes: { estado: 'confirmada' },
      despues: { estado: 'reabierta' },
      movimiento: { id: movimientoId, antes: 'conciliado', despues: 'abierto' },
    });
  });

  it('un admin reabre la confirmación de otra persona', async () => {
    const { id } = await confirmada({ confirmo: LUIS });

    await reabrir(id, tokenAna).expect(200);

    expect(await estadoDe('decisiones', id)).toBe('reabierta');
  });

  it('otra persona con el rol pero que no confirmó recibe 403, queda acceso_denegado y no cambia nada', async () => {
    const { id, cfdiId, movimientoId } = await confirmada({ confirmo: ANA });

    await reabrir(id, tokenLuis).expect(403);

    expect(await estadoDe('decisiones', id)).toBe('confirmada');
    expect(await estadoDe('cfdi', cfdiId)).toBe('conciliada');
    expect(await estadoDe('movimientos', movimientoId)).toBe('conciliado');
    expect(await bitacora('reabrir')).toHaveLength(0);
    expect(await bitacora('acceso_denegado')).toHaveLength(1);
  });

  it('un auditor recibe 403 aunque hubiera confirmado', async () => {
    const { id } = await confirmada({ confirmo: LUIS });
    const cambiarRol = (rol: string) =>
      ds.query(
        `UPDATE user_company_roles SET rol = $3 WHERE user_id = $1 AND company_id = $2`,
        [entorno.persona(LUIS), A, rol],
      );
    await cambiarRol('auditor');
    try {
      await reabrir(id, await entorno.token(LUIS, FERRETERIA)).expect(403);
    } finally {
      await cambiarRol('contador');
    }

    expect(await estadoDe('decisiones', id)).toBe('confirmada');
  });

  it.each([{}, { motivo: '' }, { motivo: '   ' }, { motivo: 42 }])(
    'sin motivo válido (%j) responde 400 y no escribe nada',
    async (cuerpo) => {
      const { id, movimientoId } = await confirmada();

      await reabrir(id, tokenAna, cuerpo).expect(400);

      expect(await estadoDe('decisiones', id)).toBe('confirmada');
      expect(await estadoDe('movimientos', movimientoId)).toBe('conciliado');
      expect(await bitacora('reabrir')).toHaveLength(0);
    },
  );

  it('una decisión que no está confirmada responde 409', async () => {
    const cfdiId = await factura(A, 'abierta');
    const movimientoId = await movimiento(A, 'abierto');
    const id = await sembrarDecision(ds, {
      companyId: A,
      movimientoId,
      cfdiId,
      estado: 'propuesta',
    });

    await reabrir(id).expect(409);

    expect(await estadoDe('decisiones', id)).toBe('propuesta');
  });

  it('una decisión de otra empresa o inexistente responde 404', async () => {
    const ajena = await confirmada({ empresa: B });

    await reabrir(ajena.id).expect(404);
    await reabrir(randomUUID()).expect(404);

    expect(await estadoDe('decisiones', ajena.id)).toBe('confirmada');
  });

  it('dos reaperturas a la vez: una da 200, la otra 409, y queda una sola fila en la bitácora', async () => {
    const { id } = await confirmada();

    const resultados = await Promise.all([reabrir(id), reabrir(id)]);

    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await bitacora('reabrir')).toHaveLength(1);
  });

  it('una confirmación en «Requiere revisión» deja la factura cancelada y limpia la marca', async () => {
    const { id, cfdiId, movimientoId } = await confirmada({
      cfdi: 'cancelada',
    });
    await ds.query(
      'UPDATE decisiones SET requiere_revision = true WHERE id = $1',
      [id],
    );

    await reabrir(id).expect(200);

    expect(await estadoDe('cfdi', cfdiId)).toBe('cancelada');
    expect(await estadoDe('movimientos', movimientoId)).toBe('abierto');
    const { requiere_revision } = await una<{ requiere_revision: boolean }>(
      ds,
      'SELECT requiere_revision FROM decisiones WHERE id = $1',
      [id],
    );
    expect(requiere_revision).toBe(false);
  });

  it('tras reabrir el motor puede proponer de nuevo y la reconfirmación crea una decisión nueva', async () => {
    jest.restoreAllMocks();
    const { id, movimientoId } = await confirmada({ confirmo: LUIS });

    await reabrir(id, tokenLuis).expect(200);
    await entorno.app.get(ConciliacionService).conciliar(A);

    const decisiones = await filas<{ id: string; estado: string }>(
      ds,
      `SELECT id, estado FROM decisiones WHERE movimiento_id = $1 ORDER BY estado`,
      [movimientoId],
    );
    expect(decisiones.map((d) => d.estado)).toEqual(['propuesta', 'reabierta']);
    const nueva = decisiones.find((d) => d.estado === 'propuesta')!;
    expect(nueva.id).not.toBe(id);

    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${nueva.id}/confirmar`)
      .set('Cookie', tokenAna)
      .send()
      .expect(200);
    expect(await estadoDe('decisiones', nueva.id)).toBe('confirmada');
    expect(await estadoDe('decisiones', id)).toBe('reabierta');
  });
});
