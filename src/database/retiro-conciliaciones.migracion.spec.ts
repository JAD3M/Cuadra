import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, type QueryRunner } from 'typeorm';
import { opcionesDataSource } from './data-source';
import { sembrar } from './seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from './testing/base-de-pruebas';

/**
 * Historia 4.3 (AD-20 paso 4, AC3): la migración `RetirarConciliaciones`
 * borra la tabla vieja solo si cada fila ya vive en `decisiones`, y su `down`
 * la recrea idéntica. Las pruebas corren sobre dos bases propias (se crean y
 * se borran aquí) para poder recorrer la secuencia completa desde cero sin
 * tocar la base compartida de las demás suites.
 */

const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';
const ESTADOS = ['confirmada', 'propuesta', 'rechazada'] as const;
const PREFIJO_RETIRO = '1790711000000';

function urlConSufijo(sufijo: string): string {
  const url = new URL(urlDePruebas());
  url.pathname = `${url.pathname}_${sufijo}`;
  return url.toString();
}

const URL_COMPLETA = urlConSufijo('retiro');
const URL_PREVIA = urlConSufijo('retiro_previa');

async function borrarBase(url: string): Promise<void> {
  const mantenimiento = new URL(url);
  const nombre = mantenimiento.pathname.replace(/^\//, '');
  mantenimiento.pathname = '/postgres';
  const ds = await new DataSource({
    type: 'postgres',
    url: mantenimiento.toString(),
  }).initialize();
  try {
    await ds.query(
      `DROP DATABASE IF EXISTS "${nombre.replace(/"/g, '""')}" WITH (FORCE)`,
    );
  } finally {
    await ds.destroy();
  }
}

/**
 * Las migraciones hasta la de retiro (inclusive, o exclusive con `incluirRetiro`
 * en false). Las posteriores no son de este spec: así sigue valiendo que el
 * retiro sea la última aunque se agreguen migraciones después.
 */
function migracionesHastaRetiro(incluirRetiro: boolean): string[] {
  const dir = join(__dirname, 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => {
      const marca = f.slice(0, PREFIJO_RETIRO.length);
      return incluirRetiro ? marca <= PREFIJO_RETIRO : marca < PREFIJO_RETIRO;
    })
    .sort()
    .map((f) => join(dir, f));
}

/** Base nueva con las migraciones indicadas (por defecto, todas). */
async function baseNueva(
  url: string,
  migraciones?: string[],
): Promise<DataSource> {
  await borrarBase(url);
  await crearBaseDePruebas(url);
  const ds = await new DataSource({
    ...opcionesDataSource,
    url,
    ...(migraciones ? { migrations: migraciones } : {}),
  }).initialize();
  await ds.runMigrations();
  return ds;
}

/** Transacción confirmada con `app.company_id` fijado: RLS FORCE alcanza al dueño. */
async function comoEmpresa<T>(
  ds: DataSource,
  empresa: string,
  cuerpo: (qr: QueryRunner) => Promise<T>,
): Promise<T> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
    const resultado = await cuerpo(qr);
    await qr.commitTransaction();
    return resultado;
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}

/** Todo lo que define a la tabla: columnas, restricciones, índices, RLS y permisos. */
async function radiografia(ds: DataSource) {
  const tabla = `'public.conciliaciones'::regclass`;
  return {
    columnas: await filas(
      ds,
      `SELECT column_name, data_type, character_maximum_length, numeric_precision,
              numeric_scale, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'conciliaciones'
        ORDER BY ordinal_position`,
    ),
    restricciones: await filas(
      ds,
      `SELECT conname, contype, pg_get_constraintdef(oid) AS def
         FROM pg_constraint WHERE conrelid = ${tabla} ORDER BY conname`,
    ),
    indices: await filas(
      ds,
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'conciliaciones'
        ORDER BY indexname`,
    ),
    rls: await una(
      ds,
      `SELECT relrowsecurity, relforcerowsecurity, relowner::regrole::text AS duenio,
              relacl::text AS permisos
         FROM pg_class WHERE oid = ${tabla}`,
    ),
    politicas: await filas(
      ds,
      `SELECT policyname, permissive, roles::text AS roles, cmd, qual, with_check
         FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conciliaciones'
        ORDER BY policyname`,
    ),
  };
}

const existeTabla = async (ds: DataSource, tabla: string): Promise<boolean> =>
  (
    await una<{ ok: boolean }>(
      ds,
      `SELECT to_regclass('public.${tabla}') IS NOT NULL AS ok`,
    )
  ).ok;

const migracionRegistrada = async (ds: DataSource): Promise<boolean> =>
  (
    await filas(
      ds,
      `SELECT 1 FROM migrations WHERE name = 'RetirarConciliaciones${PREFIJO_RETIRO}'`,
    )
  ).length === 1;

interface FilaV1 {
  id: string;
  company_id: string;
  cfdi_id: string;
  movimiento_id: string;
  estado: string;
  origen: string;
  regla: string | null;
  score: string | null;
  diferencia_monto: string | null;
  motivo: string | null;
  confirmada_por_id: string | null;
  confirmada_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const DE_LA_EMPRESA = `company_id = nullif(current_setting('app.company_id', true), '')::uuid`;

const SQL_FILAS_V1 = `SELECT id, company_id, cfdi_id, movimiento_id, estado, origen, regla,
       score, diferencia_monto, motivo, confirmada_por_id, confirmada_at,
       created_at, updated_at
  FROM conciliaciones WHERE ${DE_LA_EMPRESA} ORDER BY id`;

async function nuevoCfdi(qr: QueryRunner, empresa: string, rfc: string) {
  const { id } = await una<{ id: string }>(
    qr,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
                       fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
     VALUES ($1, $2, 'AAA010101AAA', $3, '2026-09-01T10:00:00', 'I', 100, 116,
             '{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [empresa, randomUUID(), rfc],
  );
  return id;
}

async function nuevoMovimiento(
  qr: QueryRunner,
  empresa: string,
  linea: number,
) {
  const { id } = await una<{ id: string }>(
    qr,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
     VALUES ($1, $2, '2026-09-02', 'SPEI RETIRO', 116) RETURNING id`,
    [empresa, linea],
  );
  return id;
}

/** La v1 de una empresa: un movimiento con una conciliación por estado, y su bitácora. */
async function sembrarV1(ds: DataSource, rfc: string): Promise<string> {
  const { id: empresa } = await una<{ id: string }>(
    ds,
    `SELECT id FROM companies WHERE rfc = $1`,
    [rfc],
  );
  const { id: usuario } = await una<{ id: string }>(
    ds,
    `SELECT id FROM users WHERE email = 'ana.reyes@fdb.mx'`,
  );
  await comoEmpresa(ds, empresa, async (qr) => {
    const movimiento = await nuevoMovimiento(qr, empresa, 9500);
    let n = 0;
    for (const estado of ESTADOS) {
      n += 1;
      const cfdi = await nuevoCfdi(qr, empresa, rfc);
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
          confirmada ? usuario : null,
          confirmada ? '2026-09-03T12:00:00Z' : null,
        ],
      );
      await qr.query(
        `INSERT INTO bitacora (company_id, entidad, entidad_id, accion)
         VALUES ($1, 'conciliaciones', $2, 'crear')`,
        [empresa, id],
      );
    }
  });
  return empresa;
}

const bitacoraHistorica = (ds: DataSource, empresa: string) =>
  comoEmpresa(ds, empresa, (qr) =>
    filas<{ entidad_id: string }>(
      qr,
      `SELECT entidad_id FROM bitacora
        WHERE company_id = $1 AND entidad = 'conciliaciones' ORDER BY entidad_id`,
      [empresa],
    ),
  );

const idsDeDecisiones = (ds: DataSource, empresa: string) =>
  comoEmpresa(ds, empresa, async (qr) =>
    (
      await filas<{ id: string }>(
        qr,
        `SELECT id FROM decisiones WHERE company_id = $1 ORDER BY id`,
        [empresa],
      )
    ).map((d) => d.id),
  );

let completa: DataSource;
let previa: DataSource;
let radiografiaPrevia: Awaited<ReturnType<typeof radiografia>>;

beforeAll(async () => {
  // La secuencia entera, desde una base vacía y con el glob real (AC3).
  completa = await baseNueva(URL_COMPLETA, migracionesHastaRetiro(true));
  // El esquema tal como queda antes de retirar la tabla: referencia del `down`.
  previa = await baseNueva(URL_PREVIA, migracionesHastaRetiro(false));
  radiografiaPrevia = await radiografia(previa);
}, 180_000);

afterAll(async () => {
  for (const ds of [completa, previa]) {
    if (ds?.isInitialized) await ds.destroy();
  }
  await borrarBase(URL_COMPLETA);
  await borrarBase(URL_PREVIA);
}, 60_000);

describe('migración RetirarConciliaciones (4.3, AD-20 paso 4)', () => {
  it('toda la secuencia corre desde cero y deja la tabla fuera', async () => {
    expect(await migracionRegistrada(completa)).toBe(true);
    expect(await existeTabla(completa, 'conciliaciones')).toBe(false);
    expect(await existeTabla(completa, 'decisiones')).toBe(true);
    expect(await existeTabla(completa, 'decision_lineas')).toBe(true);
    const pendiente = await completa.driver.createSchemaBuilder().log();
    // Esta base se detiene en el retiro: lo que agregan migraciones posteriores
    // a las entidades aparece como pendiente. La deriva con toda la secuencia
    // la vigila esquema.spec.ts.
    const posterior =
      /descartada_por_id|descartada_at|descarte_persona|ix_decisiones_company_lote|decision_comentarios|evidencia_sombra|ck_movimientos_clase|"clase"/;
    expect(
      pendiente.upQueries.map((q) => q.query).filter((q) => !posterior.test(q)),
    ).toEqual([]);
  });

  it('el down recrea la tabla idéntica: columnas, CHECK, índices, FK, RLS FORCE, política y GRANTs', async () => {
    await completa.undoLastMigration();
    try {
      expect(await existeTabla(completa, 'conciliaciones')).toBe(true);
      const recreada = await radiografia(completa);
      expect(recreada).toEqual(radiografiaPrevia);
      // Lo que debe quedar cierto, explícito y no solo «igual que antes».
      expect(recreada.rls).toMatchObject({
        relrowsecurity: true,
        relforcerowsecurity: true,
      });
      expect(
        recreada.politicas.map((p) => (p as { policyname: string }).policyname),
      ).toEqual(['rls_conciliaciones_company']);
      expect(
        recreada.restricciones.map((r) => (r as { conname: string }).conname),
      ).toEqual(
        expect.arrayContaining([
          'ck_conciliaciones_confirmada_requiere_persona',
          'ck_conciliaciones_estado',
          'ck_conciliaciones_origen',
          'ck_conciliaciones_score_rango',
          'fk_conciliaciones_cfdi',
          'fk_conciliaciones_company',
          'fk_conciliaciones_confirmada_por',
          'fk_conciliaciones_movimiento',
        ]),
      );
      const privilegios = await filas<{ p: string; ok: boolean }>(
        completa,
        `SELECT p, has_table_privilege('cuadra_app', 'conciliaciones', p) AS ok
           FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p`,
      );
      expect(Object.fromEntries(privilegios.map((r) => [r.p, r.ok]))).toEqual({
        SELECT: true,
        INSERT: true,
        UPDATE: true,
        DELETE: false,
        TRUNCATE: false,
      });
    } finally {
      await completa.runMigrations();
    }
    expect(await existeTabla(completa, 'conciliaciones')).toBe(false);
  });

  describe('sobre una base con datos de la v1', () => {
    let empresas: string[];
    let originales: FilaV1[];

    beforeAll(async () => {
      // Se vuelve al esquema de la 4.1 y se siembra la v1 como estaba entonces.
      await completa.undoLastMigration();
      await completa.undoLastMigration();
      await sembrar(completa);
      empresas = [
        await sembrarV1(completa, FERRETERIA),
        await sembrarV1(completa, TRANSPORTES),
      ];
      originales = [];
      for (const e of empresas) {
        originales.push(
          ...(await comoEmpresa(completa, e, (qr) =>
            filas<FilaV1>(qr, SQL_FILAS_V1),
          )),
        );
      }
      expect(originales).toHaveLength(6);
      expect(new Set(originales.map((o) => o.estado))).toEqual(
        new Set(ESTADOS),
      );
    }, 60_000);

    it('copia y retira: una decisión por conciliación, la tabla fuera y la bitácora intacta', async () => {
      const bitacoraAntes = await Promise.all(
        empresas.map((e) => bitacoraHistorica(completa, e)),
      );
      expect(bitacoraAntes.map((b) => b.length)).toEqual([3, 3]);

      await completa.runMigrations();

      expect(await existeTabla(completa, 'conciliaciones')).toBe(false);
      for (const [i, e] of empresas.entries()) {
        const esperadas = originales
          .filter((o) => o.company_id === e)
          .map((o) => o.id)
          .sort();
        expect(await idsDeDecisiones(completa, e)).toEqual(esperadas);
        expect(await bitacoraHistorica(completa, e)).toEqual(bitacoraAntes[i]);
        // Las filas históricas siguen apuntando a ids que existen en decisiones.
        const huerfanas = await comoEmpresa(completa, e, (qr) =>
          filas(
            qr,
            `SELECT b.entidad_id FROM bitacora b
              WHERE b.${DE_LA_EMPRESA} AND b.entidad = 'conciliaciones'
                AND NOT EXISTS (SELECT 1 FROM decisiones d WHERE d.id = b.entidad_id)`,
          ),
        );
        expect(huerfanas).toEqual([]);
      }
      const total = (
        await Promise.all(empresas.map((e) => idsDeDecisiones(completa, e)))
      ).flat();
      expect(total).toHaveLength(originales.length);
    });

    it('el down repuebla la tabla con las decisiones de una línea y deja fuera lo que no cabe', async () => {
      // Lo que `conciliaciones` no puede representar: una decisión de dos
      // líneas y una obsoleta. El `down` las omite, no falla.
      const [e] = empresas;
      const { multilinea, obsoleta } = await comoEmpresa(
        completa,
        e,
        async (qr) => {
          const { rfc } = await una<{ rfc: string }>(
            qr,
            `SELECT rfc FROM companies WHERE id = $1`,
            [e],
          );
          const movimiento = await nuevoMovimiento(qr, e, 9600);
          const multi = await una<{ id: string }>(
            qr,
            `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen,
                                   huella_conjunto)
           VALUES ($1, $2, 'conciliacion', 'propuesta', 'regla', 'multi') RETURNING id`,
            [e, movimiento],
          );
          for (let i = 0; i < 2; i++) {
            await qr.query(
              `INSERT INTO decision_lineas (company_id, decision_id, estado_decision, cfdi_id)
             VALUES ($1, $2, 'propuesta', $3)`,
              [e, multi.id, await nuevoCfdi(qr, e, rfc)],
            );
          }
          const obs = await una<{ id: string }>(
            qr,
            `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen,
                                   huella_conjunto)
           VALUES ($1, $2, 'conciliacion', 'obsoleta', 'regla', 'obsoleta') RETURNING id`,
            [e, movimiento],
          );
          await qr.query(
            `INSERT INTO decision_lineas (company_id, decision_id, estado_decision, cfdi_id)
           VALUES ($1, $2, 'obsoleta', $3)`,
            [e, obs.id, await nuevoCfdi(qr, e, rfc)],
          );
          return { multilinea: multi.id, obsoleta: obs.id };
        },
      );

      await completa.undoLastMigration();
      try {
        const restauradas: FilaV1[] = [];
        for (const emp of empresas) {
          restauradas.push(
            ...(await comoEmpresa(completa, emp, (qr) =>
              filas<FilaV1>(qr, SQL_FILAS_V1),
            )),
          );
        }
        // Las seis originales, campo por campo, y nada más.
        expect(restauradas).toEqual(originales);
        const ids = restauradas.map((r) => r.id);
        expect(ids).not.toContain(multilinea);
        expect(ids).not.toContain(obsoleta);
      } finally {
        await completa.runMigrations();
      }
      expect(await existeTabla(completa, 'conciliaciones')).toBe(false);
    });

    it('falla en voz alta y no cambia nada si una conciliación no tiene su decisión', async () => {
      const [e] = empresas;
      await completa.undoLastMigration();
      try {
        // Una conciliación que nunca se copió (p. ej., escrita por una instancia vieja).
        const huerfana = await comoEmpresa(completa, e, async (qr) => {
          const { rfc } = await una<{ rfc: string }>(
            qr,
            `SELECT rfc FROM companies WHERE id = $1`,
            [e],
          );
          const { id } = await una<{ id: string }>(
            qr,
            `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, origen)
             VALUES ($1, $2, $3, 'regla') RETURNING id`,
            [
              e,
              await nuevoCfdi(qr, e, rfc),
              await nuevoMovimiento(qr, e, 9700),
            ],
          );
          return id;
        });
        const antes = await Promise.all(
          empresas.map((emp) => idsDeDecisiones(completa, emp)),
        );

        await expect(completa.runMigrations()).rejects.toThrow(
          /No se retira conciliaciones/,
        );

        expect(await existeTabla(completa, 'conciliaciones')).toBe(true);
        expect(await migracionRegistrada(completa)).toBe(false);
        const restantes = await comoEmpresa(completa, e, (qr) =>
          filas<{ id: string }>(
            qr,
            `SELECT id FROM conciliaciones WHERE ${DE_LA_EMPRESA}`,
          ),
        );
        expect(restantes.map((r) => r.id)).toContain(huerfana);
        expect(restantes).toHaveLength(4);
        expect(
          await Promise.all(
            empresas.map((emp) => idsDeDecisiones(completa, emp)),
          ),
        ).toEqual(antes);

        await comoEmpresa(completa, e, (qr) =>
          qr.query(`DELETE FROM conciliaciones WHERE id = $1`, [huerfana]),
        );
      } finally {
        await completa.runMigrations();
      }
      expect(await existeTabla(completa, 'conciliaciones')).toBe(false);
      expect(await migracionRegistrada(completa)).toBe(true);
    });

    it('falla también si la decisión existe pero le falta su línea', async () => {
      const [e] = empresas;
      await completa.undoLastMigration();
      try {
        await comoEmpresa(completa, e, (qr) =>
          qr.query(
            `DELETE FROM decision_lineas
              WHERE decision_id = (SELECT id FROM conciliaciones WHERE estado = 'rechazada' AND ${DE_LA_EMPRESA})`,
          ),
        );
        await expect(completa.runMigrations()).rejects.toThrow(
          /No se retira conciliaciones/,
        );
        expect(await existeTabla(completa, 'conciliaciones')).toBe(true);
        // Se restaura la línea con lo que dice la conciliación: la copia manda.
        await comoEmpresa(completa, e, (qr) =>
          qr.query(
            `INSERT INTO decision_lineas (company_id, decision_id, estado_decision, cfdi_id)
             SELECT company_id, id, estado, cfdi_id FROM conciliaciones
              WHERE estado = 'rechazada' AND ${DE_LA_EMPRESA}`,
          ),
        );
      } finally {
        await completa.runMigrations();
      }
      expect(await existeTabla(completa, 'conciliaciones')).toBe(false);
    });
  });
});
