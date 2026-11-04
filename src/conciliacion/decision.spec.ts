import { DataSource, QueryRunner } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';

/**
 * Historia 4.1 (AD-3, AD-4): restricciones de `decisiones` y
 * `decision_lineas`. Corren contra Postgres real como dueño del esquema; el
 * aislamiento por empresa lo cubre `rls.spec.ts`.
 */

let ds: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

/** Ejecuta el cuerpo en una transacción que siempre se revierte. */
async function enTransaccion(
  cuerpo: (qr: QueryRunner) => Promise<void>,
): Promise<void> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await cuerpo(qr);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

interface Escenario {
  emp: string;
  usr: string;
  cfdis: string[];
  movimientos: string[];
}

async function escenario(qr: QueryRunner): Promise<Escenario> {
  const { id: emp } = await una<{ id: string }>(
    qr,
    `SELECT id FROM companies WHERE rfc = 'FDB190215QK4'`,
  );
  const { id: usr } = await una<{ id: string }>(
    qr,
    `SELECT id FROM users WHERE email = 'ana.reyes@fdb.mx'`,
  );
  const cfdis: string[] = [];
  for (const n of [1, 2]) {
    const { id } = await una<{ id: string }>(
      qr,
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
                         fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
       VALUES ($1, $2, 'AAA010101AAA', 'FDB190215QK4',
               '2026-09-01T10:00:00', 'I', 100, 116, '{"_xml":"<x/>"}'::jsonb)
       RETURNING id`,
      [emp, `8888888${n}-8888-7888-8888-888888888888`],
    );
    cfdis.push(id);
  }
  const movimientos: string[] = [];
  for (const linea of [0, 1]) {
    const { id } = await una<{ id: string }>(
      qr,
      `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
       VALUES ($1, $2, '2026-09-02', 'SPEI RECIBIDO', 116) RETURNING id`,
      [emp, linea],
    );
    movimientos.push(id);
  }
  return { emp, usr, cfdis, movimientos };
}

const INSERTAR_DECISION = `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen,
                           huella_conjunto, confirmada_por_id, confirmada_at, motivo)
   VALUES ($1, $2, $3, $4, 'manual', $5, $6, $7, $8) RETURNING id`;

async function decision(
  qr: QueryRunner,
  e: Escenario,
  movimiento: number,
  estado: string,
  huella = `v1:${movimiento}-${estado}`,
): Promise<string> {
  const confirmada = estado === 'confirmada';
  const { id } = await una<{ id: string }>(qr, INSERTAR_DECISION, [
    e.emp,
    e.movimientos[movimiento],
    'conciliacion',
    estado,
    huella,
    confirmada ? e.usr : null,
    confirmada ? new Date() : null,
    null,
  ]);
  return id;
}

async function linea(
  qr: QueryRunner,
  e: Escenario,
  decisionId: string,
  estado: string,
  cfdi: number,
): Promise<void> {
  await qr.query(
    `INSERT INTO decision_lineas (company_id, decision_id, estado_decision, cfdi_id)
     VALUES ($1, $2, $3, $4)`,
    [e.emp, decisionId, estado, e.cfdis[cfdi]],
  );
}

describe('decisiones', () => {
  it('no deja confirmar sin persona ni fecha (AD-3)', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      await expect(
        qr.query(
          `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen, huella_conjunto)
           VALUES ($1, $2, 'conciliacion', 'confirmada', 'llm', 'v1:x')`,
          [e.emp, e.movimientos[0]],
        ),
      ).rejects.toThrow(/ck_decisiones_confirmada_requiere_persona/);
    });
  });

  it('deja que una persona confirme y calcula vigente', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      const propuesta = await decision(qr, e, 0, 'propuesta');
      const confirmada = await decision(qr, e, 1, 'confirmada');
      const lineas = await filas<{ id: string; vigente: boolean }>(
        qr,
        `SELECT id, vigente FROM decisiones WHERE id = ANY($1)`,
        [[propuesta, confirmada]],
      );
      const porId = new Map(lineas.map((f) => [f.id, f.vigente]));
      expect(porId.get(propuesta)).toBe(false);
      expect(porId.get(confirmada)).toBe(true);
    });
  });

  it('rechaza dos decisiones vigentes para el mismo movimiento', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      await decision(qr, e, 0, 'confirmada', 'v1:a');
      await expect(decision(qr, e, 0, 'confirmada', 'v1:b')).rejects.toThrow(
        /ux_decisiones_company_movimiento_vigente/,
      );
    });
  });

  it('deja convivir una vigente con propuestas y reabiertas del mismo movimiento', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      await decision(qr, e, 0, 'confirmada', 'v1:a');
      await decision(qr, e, 0, 'propuesta', 'v1:b');
      await decision(qr, e, 0, 'reabierta', 'v1:c');
      await decision(qr, e, 0, 'reabierta', 'v1:d');
    });
  });

  it('rechaza repetir un conjunto propuesto o rechazado del mismo movimiento', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      await decision(qr, e, 0, 'rechazada', 'v1:igual');
      await expect(decision(qr, e, 0, 'propuesta', 'v1:igual')).rejects.toThrow(
        /ux_decisiones_movimiento_huella_abierta/,
      );
    });
  });

  it('exige motivo en un descarte y solo acepta descartada o reabierta', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      await expect(
        qr.query(INSERTAR_DECISION, [
          e.emp,
          e.movimientos[0],
          'descarte',
          'descartada',
          'v1:d',
          null,
          null,
          null,
        ]),
      ).rejects.toThrow(/ck_decisiones_descarte_coherente/);
    });
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      await expect(
        qr.query(INSERTAR_DECISION, [
          e.emp,
          e.movimientos[0],
          'descarte',
          'propuesta',
          'v1:d',
          null,
          null,
          'no es de la empresa',
        ]),
      ).rejects.toThrow(/ck_decisiones_descarte_coherente/);
    });
  });
});

describe('decision_lineas', () => {
  it('rechaza dos líneas vigentes para la misma factura', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      const a = await decision(qr, e, 0, 'confirmada');
      const b = await decision(qr, e, 1, 'confirmada');
      await linea(qr, e, a, 'confirmada', 0);
      await expect(linea(qr, e, b, 'confirmada', 0)).rejects.toThrow(
        /ux_decision_lineas_company_cfdi_vigente/,
      );
    });
  });

  it('deja que una factura figure en varias propuestas', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      const a = await decision(qr, e, 0, 'propuesta');
      const b = await decision(qr, e, 1, 'propuesta');
      await linea(qr, e, a, 'propuesta', 0);
      await linea(qr, e, b, 'propuesta', 0);
    });
  });

  it('rechaza una línea cuyo estado no es el de su decisión', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      const a = await decision(qr, e, 0, 'propuesta');
      await expect(linea(qr, e, a, 'confirmada', 0)).rejects.toThrow(
        /fk_decision_lineas_decision/,
      );
    });
  });

  it('propaga el estado de la decisión a sus líneas (ON UPDATE CASCADE)', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      const a = await decision(qr, e, 0, 'propuesta');
      await linea(qr, e, a, 'propuesta', 0);
      await qr.query(
        `UPDATE decisiones
            SET estado = 'confirmada', confirmada_por_id = $2, confirmada_at = now()
          WHERE id = $1`,
        [a, e.usr],
      );
      const fila = await una<{ estado_decision: string; vigente: boolean }>(
        qr,
        `SELECT estado_decision, vigente FROM decision_lineas WHERE decision_id = $1`,
        [a],
      );
      expect(fila).toEqual({ estado_decision: 'confirmada', vigente: true });
    });
  });

  it('no deja apuntar a un CFDI o movimiento de otra empresa', async () => {
    await enTransaccion(async (qr) => {
      const e = await escenario(qr);
      const { id: otra } = await una<{ id: string }>(
        qr,
        `SELECT id FROM companies WHERE rfc <> 'FDB190215QK4' LIMIT 1`,
      );
      await expect(
        qr.query(
          `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen, huella_conjunto)
           VALUES ($1, $2, 'conciliacion', 'propuesta', 'regla', 'v1:z')`,
          [otra, e.movimientos[0]],
        ),
      ).rejects.toThrow(/fk_decisiones_movimiento/);
    });
  });
});
