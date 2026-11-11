import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { EVENTOS_SOMBRA } from '../common/entities/tipos';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * Historia 6.1 (FR-34, FR-38, AD-3, AD-10) contra Postgres real con RLS: el
 * motor anota en `evidencia_sombra` lo que habría cerrado solo (regla 1
 * exacta), en la misma sentencia que la propuesta y sin cambiar nada más.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let servicio: ConciliacionService;
let A: string;
let B: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  servicio = entorno.app.get(ConciliacionService);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(`UPDATE companies SET tolerancia_monto = 0`);
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, evidencia_sombra, bitacora CASCADE',
  );
}

beforeEach(limpiar);

async function movimiento(
  empresa: string,
  o: {
    referencia?: string | null;
    monto?: string;
    banco?: string | null;
  } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,$4,'MXN',$5) RETURNING id`,
    [
      empresa,
      linea++,
      o.referencia === undefined ? 'A1001' : o.referencia,
      o.monto ?? '1160.00',
      o.banco === undefined ? 'bbva' : o.banco,
    ],
  );
  return id;
}

async function factura(
  empresa: string,
  o: { folio?: string; total?: string } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A',$4,'2026-09-01T10:00:00','I','MXN',$5,$5,'abierta',
             '{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [
      empresa,
      randomUUID(),
      empresa === B ? TRANSPORTES : FERRETERIA,
      o.folio ?? '1001',
      o.total ?? '1160.00',
    ],
  );
  return id;
}

const evidencias = () =>
  filas<{
    company_id: string;
    banco: string | null;
    decision_id: string;
    evento: string;
    persona_id: string | null;
    created_at: Date;
  }>(
    ds,
    `SELECT company_id, banco, decision_id, evento, persona_id, created_at
       FROM evidencia_sombra ORDER BY created_at, id`,
  );

const decisiones = () =>
  filas<{
    id: string;
    company_id: string;
    regla: string;
    estado: string;
    diferencia_monto: string | null;
  }>(
    ds,
    `SELECT id, company_id, regla, estado, diferencia_monto::text FROM decisiones ORDER BY created_at, id`,
  );

describe('evidencia_sombra: qué se registra', () => {
  it('una propuesta de la regla 1 exacta registra habria_cerrado con empresa, banco, decisión y fecha', async () => {
    const movimientoId = await movimiento(A, { banco: 'bbva' });
    const cfdiId = await factura(A);

    await servicio.conciliar(A);

    const [decision] = await decisiones();
    expect(decision).toMatchObject({
      company_id: A,
      regla: 'referencia_monto_exacto',
      estado: 'propuesta',
    });
    const registradas = await evidencias();
    expect(registradas).toHaveLength(1);
    expect(registradas[0]).toMatchObject({
      company_id: A,
      banco: 'bbva',
      decision_id: decision.id,
      evento: 'habria_cerrado',
      persona_id: null,
    });
    expect(
      Math.abs(Date.now() - registradas[0].created_at.getTime()),
    ).toBeLessThan(60_000);
    // No cierra ni cambia nada.
    expect(
      (
        await una<{ estado: string }>(
          ds,
          `SELECT estado FROM movimientos WHERE id = $1`,
          [movimientoId],
        )
      ).estado,
    ).toBe('abierto');
    expect(
      (
        await una<{ estado: string }>(
          ds,
          `SELECT estado FROM cfdi WHERE id = $1`,
          [cfdiId],
        )
      ).estado,
    ).toBe('abierta');
  });

  it('un movimiento sin banco registra la evidencia con banco nulo', async () => {
    await movimiento(A, { banco: null });
    await factura(A);

    await servicio.conciliar(A);

    expect(await evidencias()).toEqual([
      expect.objectContaining({ banco: null, evento: 'habria_cerrado' }),
    ]);
  });

  it('la regla 1 con diferencia dentro de la tolerancia no se registra (no es exacta)', async () => {
    await ds.query(`UPDATE companies SET tolerancia_monto = 50 WHERE id = $1`, [
      A,
    ]);
    await movimiento(A, { monto: '1120.00' });
    await factura(A);

    await servicio.conciliar(A);

    const [decision] = await decisiones();
    expect(decision.regla).toBe('referencia_monto_exacto');
    expect(Number(decision.diferencia_monto)).not.toBe(0);
    expect(await evidencias()).toEqual([]);
  });

  it('la regla 2 (referencia con monto distinto) no se registra', async () => {
    await movimiento(A, { monto: '1120.00' });
    await factura(A);

    await servicio.conciliar(A);

    const reglas = (await decisiones()).map((d) => d.regla);
    expect(reglas).toEqual(['referencia_monto_diferente']);
    expect(await evidencias()).toEqual([]);
  });

  it('la regla 3 (monto único, sin referencia) no se registra', async () => {
    await movimiento(A, { referencia: null });
    await factura(A);

    await servicio.conciliar(A);

    const reglas = (await decisiones()).map((d) => d.regla);
    expect(reglas).toEqual(['monto_unico']);
    expect(await evidencias()).toEqual([]);
  });

  it('un depósito que cubre varias facturas (suma_grupo) no se registra', async () => {
    await movimiento(A, { referencia: null, monto: '1160.00' });
    await factura(A, { folio: '2001', total: '500.00' });
    await factura(A, { folio: '2002', total: '660.00' });

    await servicio.conciliar(A);

    const reglas = (await decisiones()).map((d) => d.regla);
    expect(reglas).toEqual(['suma_grupo']);
    expect(await evidencias()).toEqual([]);
  });

  it('una referencia ambigua no crea propuesta ni evidencia', async () => {
    await movimiento(A);
    await factura(A, { folio: '1001', total: '1160.00' });
    await factura(A, { folio: '1001', total: '1160.00' });

    await servicio.conciliar(A);

    expect(await decisiones()).toEqual([]);
    expect(await evidencias()).toEqual([]);
  });

  it('conciliar dos veces no duplica la evidencia', async () => {
    await movimiento(A);
    await factura(A);

    await servicio.conciliar(A);
    await servicio.conciliar(A);

    expect(await decisiones()).toHaveLength(1);
    expect(await evidencias()).toHaveLength(1);
  });

  it('cada empresa registra solo la suya', async () => {
    await movimiento(A, { banco: 'bbva' });
    await factura(A);
    await movimiento(B, { banco: 'banorte' });
    await factura(B);

    await servicio.conciliar(A);
    await servicio.conciliar(B);

    const registradas = await evidencias();
    expect(registradas.map((e) => [e.company_id, e.banco]).sort()).toEqual(
      [
        [A, 'bbva'],
        [B, 'banorte'],
      ].sort(),
    );
    const decisionesDe = await decisiones();
    for (const e of registradas) {
      expect(decisionesDe.find((d) => d.id === e.decision_id)?.company_id).toBe(
        e.company_id,
      );
    }
  });
});

describe('evidencia_sombra: misma sentencia que la propuesta (S4)', () => {
  it('si la evidencia no se puede guardar, tampoco queda la propuesta', async () => {
    await movimiento(A);
    await factura(A);
    await ds.query(
      `ALTER TABLE evidencia_sombra ADD CONSTRAINT ck_prueba_falla CHECK (false) NOT VALID`,
    );
    try {
      await expect(servicio.conciliar(A)).rejects.toBeDefined();
    } finally {
      await ds.query(
        `ALTER TABLE evidencia_sombra DROP CONSTRAINT ck_prueba_falla`,
      );
    }

    expect(await decisiones()).toEqual([]);
    expect(await evidencias()).toEqual([]);
  });
});

describe('evidencia_sombra: tabla de solo agregar (S3, S6)', () => {
  it('cuadra_app solo tiene SELECT e INSERT', async () => {
    const privilegios = await filas<{ privilege_type: string }>(
      ds,
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE grantee = 'cuadra_app' AND table_name = 'evidencia_sombra'
        ORDER BY privilege_type`,
    );
    expect(privilegios.map((p) => p.privilege_type)).toEqual([
      'INSERT',
      'SELECT',
    ]);
  });

  it('el CHECK admite los cinco eventos y rechaza cualquier otro', async () => {
    await movimiento(A);
    await factura(A);
    await servicio.conciliar(A);
    const [decision] = await decisiones();

    expect([...EVENTOS_SOMBRA]).toEqual([
      'habria_cerrado',
      'confirmo',
      'rechazo',
      'desmarco',
      'reabrio',
    ]);
    for (const evento of EVENTOS_SOMBRA.filter((e) => e !== 'habria_cerrado')) {
      await ds.query(
        `INSERT INTO evidencia_sombra (company_id, decision_id, evento) VALUES ($1,$2,$3)`,
        [A, decision.id, evento],
      );
    }
    await expect(
      ds.query(
        `INSERT INTO evidencia_sombra (company_id, decision_id, evento) VALUES ($1,$2,'otro')`,
        [A, decision.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('una decisión no registra habria_cerrado dos veces', async () => {
    await movimiento(A);
    await factura(A);
    await servicio.conciliar(A);
    const [decision] = await decisiones();

    await expect(
      ds.query(
        `INSERT INTO evidencia_sombra (company_id, decision_id, evento) VALUES ($1,$2,'habria_cerrado')`,
        [A, decision.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
