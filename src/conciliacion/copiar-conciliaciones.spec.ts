import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { CopiarConciliacionesADecisiones1790710900000 } from '../database/migrations/1790710900000-CopiarConciliacionesADecisiones';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { huellaConjunto } from './huella-conjunto';

/**
 * Historia 4.1, AD-20 paso 2: la migración copia cada fila de
 * `conciliaciones` a `decisiones` (mismo id) y `decision_lineas`. Se siembra
 * la v1 primero y luego se corre el mismo backfill que la migración, dentro
 * de una transacción que siempre se revierte.
 *
 * Historia 4.3: la tabla `conciliaciones` ya no existe en el esquema final, así
 * que el spec recrea la tabla con el `down` de `RetirarConciliaciones` (lo que
 * también ejercita ese `down`) y vuelve a migrar al terminar.
 */

const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';
const ESTADOS = ['confirmada', 'propuesta', 'rechazada'] as const;

let ds: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  // La 4.3 retiró `conciliaciones`; esta migración de la 4.1 sigue en el
  // historial y copia desde ella. Se deshace el retiro (que recrea la tabla,
  // vacía) para probar la copia tal como corrió entonces.
  await ds.undoLastMigration();
  await sembrar(ds);
}, 60_000);

afterAll(async () => {
  // Deja la base compartida en la última migración, con la tabla ya retirada.
  if (ds?.isInitialized) {
    await ds.runMigrations();
    await ds.destroy();
  }
});

/** Lo mismo que corre la migración (`up`), sobre la transacción de la prueba. */
const copiar = (qr: QueryRunner): Promise<void> =>
  new CopiarConciliacionesADecisiones1790710900000().up(qr);

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

interface Sembrada {
  empresa: string;
  /** conciliacion id -> { estado, cfdi } */
  filas: Map<string, { estado: string; cfdi: string; movimiento: string }>;
}

/** Datos de la v1 de una empresa: un movimiento con las tres conciliaciones. */
async function sembrarV1(qr: QueryRunner, rfc: string): Promise<Sembrada> {
  const { id: empresa } = await una<{ id: string }>(
    qr,
    `SELECT id FROM companies WHERE rfc = $1`,
    [rfc],
  );
  const { id: usr } = await una<{ id: string }>(
    qr,
    `SELECT id FROM users WHERE email = 'ana.reyes@fdb.mx'`,
  );
  const { id: movimiento } = await una<{ id: string }>(
    qr,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
     VALUES ($1, 9400, '2026-09-02', 'SPEI BACKFILL', 116) RETURNING id`,
    [empresa],
  );
  const sembrada: Sembrada = { empresa, filas: new Map() };
  let n = 0;
  for (const estado of ESTADOS) {
    n += 1;
    const { id: cfdi } = await una<{ id: string }>(
      qr,
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
                         fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
       VALUES ($1, $2, 'AAA010101AAA', $3, '2026-09-01T10:00:00', 'I', 100, 116,
               '{"_xml":"<x/>"}'::jsonb) RETURNING id`,
      [empresa, randomUUID(), rfc],
    );
    const confirmada = estado === 'confirmada';
    const { id } = await una<{ id: string }>(
      qr,
      `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen,
                                   regla, score, diferencia_monto, motivo,
                                   confirmada_por_id, confirmada_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        empresa,
        cfdi,
        movimiento,
        estado,
        confirmada ? 'manual' : 'regla',
        confirmada ? null : 'monto_exacto',
        confirmada ? null : `0.${9 - n}500`,
        `${n}.2500`,
        `motivo ${estado}`,
        confirmada ? usr : null,
        confirmada ? '2026-09-03T12:00:00Z' : null,
      ],
    );
    sembrada.filas.set(id, { estado, cfdi, movimiento });
    await qr.query(
      `INSERT INTO bitacora (company_id, entidad, entidad_id, accion)
       VALUES ($1, 'conciliaciones', $2, 'crear')`,
      [empresa, id],
    );
  }
  return sembrada;
}

async function comoEmpresa<T>(
  qr: QueryRunner,
  empresa: string,
  cuerpo: () => Promise<T>,
): Promise<T> {
  await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
  try {
    return await cuerpo();
  } finally {
    await qr.query(`SELECT set_config('app.company_id', '', true)`);
  }
}

describe('copia de conciliaciones a decisiones (4.1, AD-20 paso 2)', () => {
  it('copia con el mismo id, una línea por decisión y la huella del TS', async () => {
    await enTransaccion(async (qr) => {
      const a = await sembrarV1(qr, FERRETERIA);
      const b = await sembrarV1(qr, TRANSPORTES);

      await copiar(qr);

      for (const s of [a, b]) {
        await comoEmpresa(qr, s.empresa, async () => {
          const decisiones = await filas<{
            id: string;
            tipo: string;
            estado: string;
            origen: string;
            regla: string | null;
            score: string | null;
            diferencia_monto: string | null;
            motivo: string;
            movimiento_id: string;
            lote_id: string | null;
            requiere_revision: boolean;
            vigente: boolean;
            huella_conjunto: string;
            confirmada_por_id: string | null;
            confirmada_at: Date | null;
          }>(qr, `SELECT * FROM decisiones WHERE company_id = $1`, [s.empresa]);
          const origen = await filas<{
            id: string;
            origen: string;
            regla: string | null;
            score: string | null;
            diferencia_monto: string | null;
            motivo: string;
            confirmada_por_id: string | null;
            confirmada_at: Date | null;
            created_at: Date;
            updated_at: Date;
          }>(qr, `SELECT * FROM conciliaciones WHERE company_id = $1`, [
            s.empresa,
          ]);

          expect(decisiones).toHaveLength(s.filas.size);
          expect(decisiones.map((d) => d.id).sort()).toEqual(
            [...s.filas.keys()].sort(),
          );
          for (const d of decisiones) {
            const esperado = s.filas.get(d.id)!;
            const c = origen.find((o) => o.id === d.id)!;
            expect(d.tipo).toBe('conciliacion');
            expect(d.estado).toBe(esperado.estado);
            expect(d.movimiento_id).toBe(esperado.movimiento);
            expect(d.origen).toBe(c.origen);
            expect(d.regla).toBe(c.regla);
            expect(d.score).toBe(c.score);
            expect(d.diferencia_monto).toBe(c.diferencia_monto);
            expect(d.motivo).toBe(c.motivo);
            expect(d.confirmada_por_id).toBe(c.confirmada_por_id);
            expect(d.confirmada_at).toEqual(c.confirmada_at);
            expect(d.lote_id).toBeNull();
            expect(d.requiere_revision).toBe(false);
            expect(d.vigente).toBe(esperado.estado === 'confirmada');
            expect(d.huella_conjunto).toBe(huellaConjunto([esperado.cfdi]));
          }

          const lineas = await filas<{
            decision_id: string;
            cfdi_id: string;
            estado_decision: string;
            vigente: boolean;
          }>(qr, `SELECT * FROM decision_lineas WHERE company_id = $1`, [
            s.empresa,
          ]);
          expect(lineas).toHaveLength(s.filas.size);
          for (const [id, esperado] of s.filas) {
            const delas = lineas.filter((l) => l.decision_id === id);
            expect(delas).toHaveLength(1);
            expect(delas[0].cfdi_id).toBe(esperado.cfdi);
            expect(delas[0].estado_decision).toBe(esperado.estado);
            expect(delas[0].vigente).toBe(esperado.estado === 'confirmada');
          }
        });
      }
    });
  });

  it('conserva created_at y updated_at', async () => {
    await enTransaccion(async (qr) => {
      const s = await sembrarV1(qr, FERRETERIA);
      await qr.query(
        `UPDATE conciliaciones SET created_at = '2026-01-02T03:04:05Z',
                updated_at = '2026-02-03T04:05:06Z' WHERE company_id = $1`,
        [s.empresa],
      );
      await copiar(qr);
      await comoEmpresa(qr, s.empresa, async () => {
        const dif = await filas<{ id: string }>(
          qr,
          `SELECT d.id FROM decisiones d JOIN conciliaciones c ON c.id = d.id
            WHERE d.company_id = $1
              AND (d.created_at <> c.created_at OR d.updated_at <> c.updated_at)`,
          [s.empresa],
        );
        expect(dif).toEqual([]);
      });
    });
  });

  it('las filas de bitácora de conciliaciones siguen apuntando a ids que existen', async () => {
    await enTransaccion(async (qr) => {
      const a = await sembrarV1(qr, FERRETERIA);
      await sembrarV1(qr, TRANSPORTES);
      await copiar(qr);
      await comoEmpresa(qr, a.empresa, async () => {
        const huerfanas = await filas<{ entidad_id: string }>(
          qr,
          `SELECT b.entidad_id FROM bitacora b
            WHERE b.company_id = $1 AND b.entidad = 'conciliaciones'
              AND NOT EXISTS (SELECT 1 FROM decisiones d WHERE d.id = b.entidad_id)`,
          [a.empresa],
        );
        expect(huerfanas).toEqual([]);
        const { n } = await una<{ n: number }>(
          qr,
          `SELECT count(*)::int AS n FROM bitacora
            WHERE company_id = $1 AND entidad = 'conciliaciones'`,
          [a.empresa],
        );
        expect(n).toBeGreaterThanOrEqual(a.filas.size);
      });
    });
  });

  it('es idempotente: correrla dos veces no duplica', async () => {
    await enTransaccion(async (qr) => {
      const a = await sembrarV1(qr, FERRETERIA);
      await copiar(qr);
      await copiar(qr);
      await comoEmpresa(qr, a.empresa, async () => {
        const { d, l } = await una<{ d: number; l: number }>(
          qr,
          `SELECT (SELECT count(*) FROM decisiones WHERE company_id = $1)::int AS d,
                  (SELECT count(*) FROM decision_lineas WHERE company_id = $1)::int AS l`,
          [a.empresa],
        );
        expect(d).toBe(a.filas.size);
        expect(l).toBe(a.filas.size);
      });
    });
  });

  it('no toca conciliaciones', async () => {
    await enTransaccion(async (qr) => {
      const a = await sembrarV1(qr, FERRETERIA);
      const antes = await filas<Record<string, unknown>>(
        qr,
        `SELECT * FROM conciliaciones WHERE company_id = $1 ORDER BY id`,
        [a.empresa],
      );
      await copiar(qr);
      const despues = await filas<Record<string, unknown>>(
        qr,
        `SELECT * FROM conciliaciones WHERE company_id = $1 ORDER BY id`,
        [a.empresa],
      );
      expect(despues).toEqual(antes);
    });
  });

  it('cada empresa ve solo sus decisiones como cuadra_app', async () => {
    await enTransaccion(async (qr) => {
      const a = await sembrarV1(qr, FERRETERIA);
      const b = await sembrarV1(qr, TRANSPORTES);
      await copiar(qr);

      await qr.query(`SET LOCAL ROLE cuadra_app`);
      try {
        for (const [propia, ajena] of [
          [a, b],
          [b, a],
        ]) {
          await comoEmpresa(qr, propia.empresa, async () => {
            const vistas = await filas<{ id: string }>(
              qr,
              `SELECT id FROM decisiones`,
            );
            expect(vistas.map((v) => v.id).sort()).toEqual(
              [...propia.filas.keys()].sort(),
            );
            const ajenas = vistas.filter((v) => ajena.filas.has(v.id));
            expect(ajenas).toEqual([]);
            const lineas = await filas<{ decision_id: string }>(
              qr,
              `SELECT decision_id FROM decision_lineas`,
            );
            expect(lineas).toHaveLength(propia.filas.size);
          });
        }
      } finally {
        await qr.query(`RESET ROLE`);
      }
    });
  });
});
