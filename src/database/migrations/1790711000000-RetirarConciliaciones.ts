import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 4.3 (AD-20 paso 4): retira la tabla `conciliaciones`. Desde la 4.2
 * toda la aplicación lee y escribe `decisiones` / `decision_lineas`; la tabla
 * vieja solo guardaba el historial que la 4.1 ya copió con el mismo id.
 *
 * `up`
 * - Antes de borrar nada comprueba, empresa por empresa, que cada fila de
 *   `conciliaciones` tiene su decisión (mismo id y mismo movimiento) y su
 *   línea (mismo CFDI), y que el conteo cuadra. Si algo falta lanza un error
 *   claro y la transacción no cambia nada: la tabla es la única fuente de ese
 *   dato y un falso «todo copiado» sería perderlo.
 * - Toma ACCESS EXCLUSIVE sobre la tabla para que nadie inserte entre la
 *   verificación y el DROP.
 * - RLS FORCE alcanza también al dueño, así que se verifica fijando
 *   `app.company_id` por empresa dentro de la transacción (plantilla de
 *   `1790710900000-CopiarConciliacionesADecisiones.ts`).
 * - `DROP TABLE` se lleva columnas, CHECK, índices, FK, política y GRANTs. La
 *   tabla no tenía columnas generadas, así que `typeorm_metadata` no guarda
 *   nada suyo; el DELETE defensivo es inocuo.
 * - La bitácora NO se toca: sus filas con entidad 'conciliaciones' son el
 *   historial (AD-7) y siguen apuntando a ids que existen en `decisiones`.
 *
 * `down` (corre como dueño del esquema; `cuadra_app` no tiene DELETE)
 * - Recrea `conciliaciones` tal como la dejaron EsquemaInicial,
 *   ResultadoExplicado, LlavesCompuestasConciliacion y AislamientoRls:
 *   columnas, CHECK `ck_conciliaciones_*`, índices único/parciales, FK
 *   compuestas, ENABLE + FORCE RLS, política y GRANT SELECT, INSERT, UPDATE.
 * - La repuebla, mejor esfuerzo, desde `decisiones` + `decision_lineas` de
 *   tipo 'conciliacion' con exactamente UNA línea y estado propuesta,
 *   confirmada o rechazada (con el mismo id).
 * - NO se puede restaurar: las decisiones con varias líneas (4.5) o con otro
 *   estado (reabierta, descartada, obsoleta), porque `conciliaciones` no tiene
 *   forma de representarlas; ni un choque con los índices únicos de la tabla
 *   (se queda la confirmada, o la más reciente). Lo que no cabe se omite sin
 *   fallar; esas decisiones siguen en `decisiones`.
 */

const ROL_APP = 'cuadra_app';

const EMPRESA_FIJADA = `nullif(current_setting('app.company_id', true), '')::uuid`;

/**
 * Filas de la empresa fijada sin su decisión + línea. `origen` es el total.
 * Una fila cuenta como copiada si su decisión tiene el mismo id y movimiento
 * y existe una línea de esa decisión para el mismo CFDI. El estado no se
 * compara: después de la 4.2 una decisión pudo pasar a otro estado.
 */
export const SQL_CONCILIACIONES_SIN_COPIA = `SELECT c."id",
  (SELECT count(*) FROM "conciliaciones"
    WHERE "company_id" = ${EMPRESA_FIJADA})::int AS origen
  FROM "conciliaciones" c
 WHERE c."company_id" = ${EMPRESA_FIJADA}
   AND NOT EXISTS (
     SELECT 1 FROM "decisiones" d
       JOIN "decision_lineas" l
         ON l."decision_id" = d."id" AND l."company_id" = d."company_id"
      WHERE d."id" = c."id"
        AND d."company_id" = c."company_id"
        AND d."movimiento_id" = c."movimiento_id"
        AND l."cfdi_id" = c."cfdi_id")
 ORDER BY c."id"`;

export const SQL_CREAR_CONCILIACIONES = `CREATE TABLE "conciliaciones" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "cfdi_id" uuid NOT NULL, "movimiento_id" uuid NOT NULL, "estado" character varying(32) NOT NULL DEFAULT 'propuesta', "origen" character varying(32) NOT NULL, "regla" character varying(64), "score" numeric(5,4), "diferencia_monto" numeric(18,4), "motivo" text, "confirmada_por_id" uuid, "confirmada_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ck_conciliaciones_confirmada_requiere_persona" CHECK (estado <> 'confirmada' OR (confirmada_por_id IS NOT NULL AND confirmada_at IS NOT NULL)), CONSTRAINT "ck_conciliaciones_score_rango" CHECK (score IS NULL OR (score >= 0 AND score <= 1)), CONSTRAINT "ck_conciliaciones_origen" CHECK (origen IN ('regla', 'llm', 'manual')), CONSTRAINT "ck_conciliaciones_estado" CHECK (estado IN ('propuesta', 'confirmada', 'rechazada')), CONSTRAINT "PK_4cf14ab22a0f3df9e85c2b56163" PRIMARY KEY ("id"))`;

const SQL_INDICES = [
  `CREATE INDEX "ix_conciliaciones_company_id_estado" ON "conciliaciones"  ("company_id", "estado") `,
  `CREATE UNIQUE INDEX "ux_conciliaciones_par" ON "conciliaciones"  ("company_id", "cfdi_id", "movimiento_id") `,
  `CREATE UNIQUE INDEX "ux_conciliaciones_movimiento_confirmada" ON "conciliaciones"  ("company_id", "movimiento_id") WHERE estado = 'confirmada'`,
  `CREATE UNIQUE INDEX "ux_conciliaciones_cfdi_confirmada" ON "conciliaciones"  ("company_id", "cfdi_id") WHERE estado = 'confirmada'`,
  `CREATE INDEX "ix_conciliaciones_company_id_movimiento_id" ON "conciliaciones" ("company_id", "movimiento_id")`,
];

const SQL_LLAVES = [
  `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
  `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_cfdi" FOREIGN KEY ("company_id", "cfdi_id") REFERENCES "cfdi"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_movimiento" FOREIGN KEY ("company_id", "movimiento_id") REFERENCES "movimientos"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_confirmada_por" FOREIGN KEY ("confirmada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
];

/**
 * Repuebla la empresa fijada. Primero la confirmada y luego la más reciente,
 * para que ante un choque de índices únicos gane la que cierra el caso.
 */
export const SQL_REPOBLAR_CONCILIACIONES = `INSERT INTO "conciliaciones"
  ("id", "created_at", "updated_at", "company_id", "cfdi_id", "movimiento_id",
   "estado", "origen", "regla", "score", "diferencia_monto", "motivo",
   "confirmada_por_id", "confirmada_at")
SELECT d."id", d."created_at", d."updated_at", d."company_id", l."cfdi_id",
       d."movimiento_id", d."estado", d."origen", d."regla", d."score",
       d."diferencia_monto", d."motivo", d."confirmada_por_id", d."confirmada_at"
  FROM "decisiones" d
  JOIN "decision_lineas" l
    ON l."decision_id" = d."id" AND l."company_id" = d."company_id"
 WHERE d."company_id" = ${EMPRESA_FIJADA}
   AND d."tipo" = 'conciliacion'
   AND d."estado" IN ('propuesta', 'confirmada', 'rechazada')
   AND (SELECT count(*) FROM "decision_lineas" x
         WHERE x."decision_id" = d."id" AND x."company_id" = d."company_id") = 1
 ORDER BY (d."estado" = 'confirmada') DESC, d."updated_at" DESC
ON CONFLICT DO NOTHING`;

export class RetirarConciliaciones1790711000000 implements MigrationInterface {
  name = 'RetirarConciliaciones1790711000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `LOCK TABLE "conciliaciones" IN ACCESS EXCLUSIVE MODE`,
    );
    const empresas = (await queryRunner.query(
      `SELECT id FROM "companies" ORDER BY id`,
    )) as Array<{ id: string }>;
    for (const { id } of empresas) {
      await queryRunner.query(`SELECT set_config('app.company_id', $1, true)`, [
        id,
      ]);
      const sinCopia = (await queryRunner.query(
        SQL_CONCILIACIONES_SIN_COPIA,
      )) as Array<{ id: string; origen: number }>;
      if (sinCopia.length > 0) {
        const total = sinCopia[0].origen;
        throw new Error(
          `No se retira conciliaciones: en la empresa ${id}, ${sinCopia.length} de ` +
            `${total} filas no tienen su decisión y su línea en ` +
            `decisiones/decision_lineas (${sinCopia
              .slice(0, 5)
              .map((f) => f.id)
              .join(', ')}${sinCopia.length > 5 ? ', ...' : ''}). ` +
            `No se cambió nada.`,
        );
      }
    }
    await queryRunner.query(`SELECT set_config('app.company_id', '', true)`);

    await queryRunner.query(`DROP TABLE "conciliaciones"`);
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "table" = 'conciliaciones'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(SQL_CREAR_CONCILIACIONES);
    for (const sql of SQL_INDICES) await queryRunner.query(sql);
    for (const sql of SQL_LLAVES) await queryRunner.query(sql);

    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_conciliaciones_company" ON "conciliaciones"
         USING (company_id = ${EMPRESA_FIJADA})
         WITH CHECK (company_id = ${EMPRESA_FIJADA})`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON "conciliaciones" TO ${ROL_APP}`,
    );

    // Dueño del esquema: RLS FORCE también lo filtra, así que se repuebla
    // empresa por empresa con `app.company_id` fijado en la transacción.
    const empresas = (await queryRunner.query(
      `SELECT id FROM "companies" ORDER BY id`,
    )) as Array<{ id: string }>;
    for (const { id } of empresas) {
      await queryRunner.query(`SELECT set_config('app.company_id', $1, true)`, [
        id,
      ]);
      await queryRunner.query(SQL_REPOBLAR_CONCILIACIONES);
    }
    await queryRunner.query(`SELECT set_config('app.company_id', '', true)`);
  }
}
