import type { DataSource } from 'typeorm';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { una } from '../database/testing/base-de-pruebas';
import { ColaMuestras } from './cola-muestras';
import { MuestrasService } from './muestras.service';

/**
 * Historia 9.3 (FR-63, AD-10, AD-19): la muestra del mes se sortea una vez,
 * se guarda y no se repite. Cada criterio, con datos de dos empresas.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let muestras: MuestrasService;
let cola: ColaMuestras;
let A: string;
let B: string;
let persona: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  muestras = entorno.app.get(MuestrasService);
  cola = entorno.app.get(ColaMuestras);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  persona = (await una<{ id: string }>(ds, `SELECT id FROM users LIMIT 1`)).id;
}, 60_000);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE muestras_verificacion, evidencia_sombra, decision_lineas, decisiones, movimientos CASCADE',
  );
}

beforeEach(limpiar);

interface Siembra {
  estado?: string;
  regla?: string;
  lote?: boolean;
  confirmadaEn?: string;
}

/** `n` decisiones, cada una con su movimiento; por defecto, de la regla 1, confirmadas en lote en septiembre. */
async function sembrar(
  empresa: string,
  n: number,
  o: Siembra = {},
): Promise<string[]> {
  const estado = o.estado ?? 'confirmada';
  const inicio = linea;
  linea += n;
  const filas = await ds.query<{ id: string }[]>(
    `WITH m AS (
       INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
       SELECT $1, g, '2026-09-02', 'SPEI RECIBIDO', 'R' || g, '100.00', 'MXN', 'bbva'
         FROM generate_series($2::int, $3::int) g
       RETURNING id
     )
     INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen, regla, huella_conjunto,
                             confirmada_por_id, confirmada_at, lote_id)
     SELECT $1, m.id, 'conciliacion', $4::varchar, 'regla', $5, gen_random_uuid()::text,
            CASE WHEN $4::varchar = 'confirmada' THEN $6::uuid END,
            CASE WHEN $4::varchar = 'confirmada' THEN $7::timestamptz END,
            CASE WHEN $8::boolean THEN gen_random_uuid() END
       FROM m
     RETURNING id`,
    [
      empresa,
      inicio,
      inicio + n - 1,
      estado,
      o.regla ?? 'referencia_monto_exacto',
      persona,
      o.confirmadaEn ?? '2026-09-15T12:00:00Z',
      o.lote ?? true,
    ],
  );
  return filas.map((f) => f.id);
}

const guardadas = async (empresa: string, mes = '2026-09-01') =>
  (
    await ds.query<{ decision_id: string }[]>(
      `SELECT decision_id FROM muestras_verificacion
        WHERE company_id = $1 AND mes = $2 ORDER BY decision_id`,
      [empresa, mes],
    )
  ).map((f) => f.decision_id);

describe('muestra de verificación del mes (9.3)', () => {
  it('sortea el 5 % con un mínimo de 20 y lo guarda (S1, S2)', async () => {
    const lote = await sembrar(A, 100); // 5 % = 5 → mínimo 20

    const r = await muestras.generar(A, '2026-09');

    expect(r.estado).toBe('generada');
    expect(r.mes).toBe('2026-09-01');
    expect(r.decisionIds).toHaveLength(20);
    expect(new Set(r.decisionIds).size).toBe(20);
    expect(r.decisionIds.every((id) => lote.includes(id))).toBe(true);
    expect(await guardadas(A)).toEqual([...r.decisionIds].sort());
  });

  it('con muchas confirmaciones usa el 5 %, redondeado hacia arriba (S1)', async () => {
    await sembrar(A, 500); // 25
    expect((await muestras.generar(A, '2026-09')).decisionIds).toHaveLength(25);
    await limpiar();
    await sembrar(A, 410); // 20.5 → 21
    expect((await muestras.generar(A, '2026-09')).decisionIds).toHaveLength(21);
  });

  it('con menos de 20 toma todas (S1)', async () => {
    const lote = await sembrar(A, 7);
    const r = await muestras.generar(A, '2026-09');
    expect([...r.decisionIds].sort()).toEqual([...lote].sort());
  });

  it('solo cuentan las confirmadas en lote, de la regla 1, en ese mes y de esa empresa (S1)', async () => {
    const buenas = await sembrar(A, 3);
    await sembrar(A, 2, { lote: false }); // una a una
    await sembrar(A, 2, { regla: 'otra_regla' });
    await sembrar(A, 2, { estado: 'reabierta' });
    await sembrar(A, 2, { estado: 'propuesta' });
    await sembrar(A, 2, { confirmadaEn: '2026-08-31T23:59:59Z' });
    await sembrar(A, 2, { confirmadaEn: '2026-10-01T00:00:00Z' });
    await sembrar(B, 4);

    const r = await muestras.generar(A, '2026-09');

    expect([...r.decisionIds].sort()).toEqual([...buenas].sort());
  });

  it('ejecutar otra vez devuelve la misma muestra, aunque lleguen más confirmaciones (S2)', async () => {
    await sembrar(A, 100);
    const primera = await muestras.generar(A, '2026-09');
    await sembrar(A, 300);

    const segunda = await muestras.generar(A, '2026-09');

    expect(segunda.estado).toBe('existente');
    expect([...segunda.decisionIds].sort()).toEqual(
      [...primera.decisionIds].sort(),
    );
    expect(await guardadas(A)).toHaveLength(20);
  });

  it('sin confirmaciones en lote no crea muestra y lo dice (S3)', async () => {
    await sembrar(A, 5, { lote: false });

    const r = await muestras.generar(A, '2026-09');

    expect(r).toEqual({
      estado: 'sin_casos',
      mes: '2026-09-01',
      decisionIds: [],
    });
    expect(await guardadas(A)).toEqual([]);
  });

  it('dos corridas a la vez dejan una sola muestra (S4)', async () => {
    await sembrar(A, 100);

    const [x, y] = await Promise.all([
      muestras.generar(A, '2026-09'),
      muestras.generar(A, '2026-09'),
    ]);

    expect([x.estado, y.estado].sort()).toEqual(['existente', 'generada']);
    expect([...x.decisionIds].sort()).toEqual([...y.decisionIds].sort());
    expect(await guardadas(A)).toHaveLength(20);
  });

  it('cada empresa y cada mes tiene su propia muestra (S2)', async () => {
    await sembrar(A, 30);
    await sembrar(B, 30);
    await sembrar(A, 30, { confirmadaEn: '2026-10-05T00:00:00Z' });

    const a = await muestras.generar(A, '2026-09');
    const b = await muestras.generar(B, '2026-09');
    const aOctubre = await muestras.generar(A, '2026-10');

    expect(a.decisionIds).toHaveLength(20);
    expect(b.decisionIds).toHaveLength(20);
    expect(aOctubre.decisionIds).toHaveLength(20);
    expect(a.decisionIds.some((id) => b.decisionIds.includes(id))).toBe(false);
    expect(await guardadas(B)).toHaveLength(20);
    expect(await guardadas(A, '2026-10-01')).toHaveLength(20);
  });

  it('rechaza un mes que no es AAAA-MM', async () => {
    await expect(muestras.generar(A, '2026-13')).rejects.toThrow(/AAAA-MM/);
    await expect(muestras.generar(A, 'septiembre')).rejects.toThrow(/AAAA-MM/);
  });

  it('cuadra_app solo puede leer e insertar, y la tabla tiene RLS con FORCE (S5)', async () => {
    const permisos = await ds.query<{ privilegio: string }[]>(
      `SELECT privilege_type AS privilegio FROM information_schema.role_table_grants
        WHERE table_name = 'muestras_verificacion' AND grantee = 'cuadra_app'
        ORDER BY privilege_type`,
    );
    expect(permisos.map((p) => p.privilegio)).toEqual(['INSERT', 'SELECT']);
    const rls = await una<{ rls: boolean; forzada: boolean }>(
      ds,
      `SELECT relrowsecurity AS rls, relforcerowsecurity AS forzada
         FROM pg_class WHERE relname = 'muestras_verificacion'`,
    );
    expect(rls).toEqual({ rls: true, forzada: true });
  });

  it('corre como trabajo en segundo plano, idempotente por empresa y mes (S4)', async () => {
    await sembrar(A, 100);

    await cola.encolar(A, '2026-09');
    await cola.encolar(A, '2026-09'); // mismo trabajo: no duplica
    const limite = Date.now() + 15_000;
    while ((await guardadas(A)).length === 0 && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const primera = await guardadas(A);
    expect(primera).toHaveLength(20);

    // Reencolar un trabajo ya terminado devuelve la misma muestra.
    await cola.encolar(A, '2026-09');
    await new Promise((r) => setTimeout(r, 1_000));
    expect(await guardadas(A)).toEqual(primera);
  });
});
