import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 4.1 (AD-20 paso 2): copia cada fila de `conciliaciones` a
 * `decisiones` con el MISMO id y crea su línea en `decision_lineas`. La v1
 * sigue leyendo y escribiendo `conciliaciones`; no se toca.
 *
 * - tipo 'conciliacion'; estado, origen, regla, score, diferencia_monto,
 *   motivo, confirmada_por_id, confirmada_at, movimiento_id, created_at y
 *   updated_at se copian tal cual; lote_id NULL; requiere_revision false;
 *   huella_conjunto = huella_conjunto(ARRAY[cfdi_id]) (un CFDI por fila).
 * - Los tres estados de la v1 son estados válidos de `decisiones`, así que
 *   no hay conversión de estado.
 * - Los índices únicos parciales nuevos no pueden chocar con datos de la v1:
 *   `ux_conciliaciones_par` (company, cfdi, movimiento) impide dos filas con
 *   el mismo movimiento y la misma huella (el conjunto es un solo CFDI);
 *   `ux_conciliaciones_movimiento_confirmada` y `..._cfdi_confirmada` son los
 *   equivalentes de `ux_decisiones_company_movimiento_vigente` y
 *   `ux_decision_lineas_company_cfdi_vigente`. Si aun así algo chocara, el
 *   INSERT falla en voz alta: nunca se descarta una fila en silencio.
 * - Idempotente: ON CONFLICT (id) DO NOTHING en la decisión y la línea solo
 *   se crea si la decisión no tiene ninguna.
 * - Las tablas tienen RLS FORCE y el dueño tampoco se la salta, así que se
 *   copia empresa por empresa fijando `app.company_id` dentro de la
 *   transacción (plantilla `1790710400000-HuellaMovimientos.ts`). Por empresa
 *   se compara el conteo de origen y destino; si difieren, la migración falla.
 *
 * `down` borra solo lo que esta migración pudo crear: decisiones cuyo id
 * existe en `conciliaciones` y sus líneas. Corre como dueño del esquema:
 * `cuadra_app` no tiene DELETE (decisiones sin origen v1, creadas después por
 * la aplicación, se conservan).
 */

/** Copia las decisiones de la empresa fijada en `app.company_id`. */
export const SQL_COPIAR_DECISIONES = `INSERT INTO "decisiones"
  ("id", "created_at", "updated_at", "company_id", "movimiento_id", "tipo",
   "estado", "origen", "regla", "score", "diferencia_monto", "confirmada_por_id",
   "confirmada_at", "lote_id", "motivo", "requiere_revision", "huella_conjunto")
SELECT c."id", c."created_at", c."updated_at", c."company_id", c."movimiento_id",
       'conciliacion', c."estado", c."origen", c."regla", c."score",
       c."diferencia_monto", c."confirmada_por_id", c."confirmada_at", NULL,
       c."motivo", false, huella_conjunto(ARRAY[c."cfdi_id"])
  FROM "conciliaciones" c
 WHERE c."company_id" = nullif(current_setting('app.company_id', true), '')::uuid
ON CONFLICT ("id") DO NOTHING`;

/** Una línea por conciliación; no repite si la decisión ya tiene línea. */
export const SQL_COPIAR_LINEAS = `INSERT INTO "decision_lineas"
  ("created_at", "updated_at", "company_id", "decision_id", "estado_decision", "cfdi_id")
SELECT c."created_at", c."updated_at", c."company_id", c."id", c."estado", c."cfdi_id"
  FROM "conciliaciones" c
 WHERE c."company_id" = nullif(current_setting('app.company_id', true), '')::uuid
   AND NOT EXISTS (SELECT 1 FROM "decision_lineas" l WHERE l."decision_id" = c."id")`;

/** Conteos de la empresa fijada: origen, decisiones con id de origen y líneas. */
export const SQL_CONTEOS_COPIA = `SELECT
  (SELECT count(*) FROM "conciliaciones"
    WHERE "company_id" = nullif(current_setting('app.company_id', true), '')::uuid)::int AS origen,
  (SELECT count(*) FROM "decisiones" d
    WHERE d."company_id" = nullif(current_setting('app.company_id', true), '')::uuid
      AND EXISTS (SELECT 1 FROM "conciliaciones" c WHERE c."id" = d."id"))::int AS decisiones,
  (SELECT count(*) FROM "decision_lineas" l
    WHERE l."company_id" = nullif(current_setting('app.company_id', true), '')::uuid
      AND EXISTS (SELECT 1 FROM "conciliaciones" c WHERE c."id" = l."decision_id"))::int AS lineas`;

/**
 * Corre la copia para todas las empresas y verifica los conteos. Debe correr
 * dentro de una transacción: `set_config(..., true)` solo vale en ella.
 */
async function copiarConciliacionesADecisiones(
  queryRunner: QueryRunner,
): Promise<void> {
  const empresas = (await queryRunner.query(
    `SELECT id FROM "companies"`,
  )) as Array<{ id: string }>;
  for (const { id } of empresas) {
    await queryRunner.query(`SELECT set_config('app.company_id', $1, true)`, [
      id,
    ]);
    await queryRunner.query(SQL_COPIAR_DECISIONES);
    await queryRunner.query(SQL_COPIAR_LINEAS);
    const [conteo] = (await queryRunner.query(SQL_CONTEOS_COPIA)) as Array<{
      origen: number;
      decisiones: number;
      lineas: number;
    }>;
    if (
      conteo.decisiones !== conteo.origen ||
      conteo.lineas !== conteo.origen
    ) {
      throw new Error(
        `La copia de conciliaciones a decisiones no cuadra en la empresa ${id}: ` +
          `${conteo.origen} conciliaciones, ${conteo.decisiones} decisiones, ` +
          `${conteo.lineas} líneas.`,
      );
    }
  }
  await queryRunner.query(`SELECT set_config('app.company_id', '', true)`);
}

export class CopiarConciliacionesADecisiones1790710900000 implements MigrationInterface {
  name = 'CopiarConciliacionesADecisiones1790710900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await copiarConciliacionesADecisiones(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dueño del esquema (cuadra_app no tiene DELETE). Se fija la empresa
    // porque RLS FORCE también aplica al dueño.
    const empresas = (await queryRunner.query(
      `SELECT id FROM "companies"`,
    )) as Array<{ id: string }>;
    for (const { id } of empresas) {
      await queryRunner.query(`SELECT set_config('app.company_id', $1, true)`, [
        id,
      ]);
      await queryRunner.query(
        `DELETE FROM "decision_lineas" l
          WHERE EXISTS (SELECT 1 FROM "conciliaciones" c WHERE c."id" = l."decision_id")`,
      );
      await queryRunner.query(
        `DELETE FROM "decisiones" d
          WHERE EXISTS (SELECT 1 FROM "conciliaciones" c WHERE c."id" = d."id")`,
      );
    }
    await queryRunner.query(`SELECT set_config('app.company_id', '', true)`);
  }
}
