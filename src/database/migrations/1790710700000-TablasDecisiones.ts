import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 4.1 (AD-2, AD-3, AD-4, AD-20 paso 1). Tablas de dominio (clase 1)
 * `decisiones` y `decision_lineas`: company_id, RLS con FORCE, política y
 * GRANTs aquí mismo. Sin DELETE para `cuadra_app`.
 *
 * - `vigente` es una columna generada en ambas tablas; los índices únicos
 *   parciales sobre ella reemplazan a los triggers. TypeORM lee la expresión
 *   de `typeorm_metadata`, así que se registra (y `down` la retira).
 * - `decision_lineas.estado_decision` sigue a `decisiones.estado` por FK
 *   compuesta con ON UPDATE CASCADE; por eso `decisiones` lleva
 *   UNIQUE (id, estado).
 * - Las FK a `movimientos` y `cfdi` son compuestas con company_id
 *   (ver 1790708900000). Riesgo conocido: la FK de la línea hacia la decisión
 *   no incluye company_id (AD-4); solo el dueño del esquema podría cruzar
 *   empresas, RLS cubre al rol de la app.
 * - Las listas de los CHECK deben coincidir con `ESTADOS_DECISION`,
 *   `TIPOS_DECISION` y `ORIGENES_CONCILIACION`.
 * - No crea `huella_conjunto` ni copia datos de `conciliaciones` (tareas
 *   posteriores de la historia).
 */
const ROL_APP = 'cuadra_app';
const POLITICA = `USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
         WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`;

export class TablasDecisiones1790710700000 implements MigrationInterface {
  name = 'TablasDecisiones1790710700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "decisiones" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "movimiento_id" uuid NOT NULL, "tipo" character varying(32) NOT NULL, "estado" character varying(32) NOT NULL DEFAULT 'propuesta', "origen" character varying(32) NOT NULL, "regla" character varying(64), "score" numeric(5,4), "diferencia_monto" numeric(18,4), "confirmada_por_id" uuid, "confirmada_at" TIMESTAMP WITH TIME ZONE, "lote_id" uuid, "motivo" text, "requiere_revision" boolean NOT NULL DEFAULT false, "huella_conjunto" character varying NOT NULL, "vigente" boolean GENERATED ALWAYS AS (estado IN ('confirmada', 'descartada')) STORED NOT NULL, CONSTRAINT "ck_decisiones_estado" CHECK (estado IN ('propuesta', 'confirmada', 'rechazada', 'reabierta', 'descartada', 'obsoleta')), CONSTRAINT "ck_decisiones_tipo" CHECK (tipo IN ('conciliacion', 'descarte')), CONSTRAINT "ck_decisiones_origen" CHECK (origen IN ('regla', 'llm', 'manual')), CONSTRAINT "ck_decisiones_score_rango" CHECK (score IS NULL OR (score >= 0 AND score <= 1)), CONSTRAINT "ck_decisiones_confirmada_requiere_persona" CHECK (estado <> 'confirmada' OR (confirmada_por_id IS NOT NULL AND confirmada_at IS NOT NULL)), CONSTRAINT "ck_decisiones_descarte_coherente" CHECK (tipo <> 'descarte' OR (motivo IS NOT NULL AND estado IN ('descartada', 'reabierta'))), CONSTRAINT "PK_decisiones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "decision_lineas" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "decision_id" uuid NOT NULL, "estado_decision" character varying(32) NOT NULL, "cfdi_id" uuid NOT NULL, "vigente" boolean GENERATED ALWAYS AS (estado_decision IN ('confirmada', 'descartada')) STORED NOT NULL, CONSTRAINT "PK_decision_lineas" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata" ("type", "database", "schema", "table", "name", "value")
       VALUES ('GENERATED_COLUMN', current_database(), 'public', 'decisiones', 'vigente', 'estado IN (''confirmada'', ''descartada'')'),
              ('GENERATED_COLUMN', current_database(), 'public', 'decision_lineas', 'vigente', 'estado_decision IN (''confirmada'', ''descartada'')')`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_decisiones_id_estado" ON "decisiones" ("id", "estado")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_decisiones_company_movimiento_vigente" ON "decisiones" ("company_id", "movimiento_id") WHERE vigente`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_decisiones_movimiento_huella_abierta" ON "decisiones" ("movimiento_id", "huella_conjunto") WHERE estado IN ('propuesta', 'rechazada')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_decisiones_company_id_estado" ON "decisiones" ("company_id", "estado")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_decision_lineas_company_cfdi_vigente" ON "decision_lineas" ("company_id", "cfdi_id") WHERE vigente`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_decision_lineas_company_id_decision_id" ON "decision_lineas" ("company_id", "decision_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "decisiones" ADD CONSTRAINT "fk_decisiones_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisiones" ADD CONSTRAINT "fk_decisiones_movimiento" FOREIGN KEY ("company_id", "movimiento_id") REFERENCES "movimientos"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisiones" ADD CONSTRAINT "fk_decisiones_confirmada_por" FOREIGN KEY ("confirmada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_lineas" ADD CONSTRAINT "fk_decision_lineas_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_lineas" ADD CONSTRAINT "fk_decision_lineas_decision" FOREIGN KEY ("decision_id", "estado_decision") REFERENCES "decisiones"("id", "estado") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_lineas" ADD CONSTRAINT "fk_decision_lineas_cfdi" FOREIGN KEY ("company_id", "cfdi_id") REFERENCES "cfdi"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    for (const tabla of ['decisiones', 'decision_lineas']) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `CREATE POLICY "rls_${tabla}_company" ON "${tabla}"
         ${POLITICA}`,
      );
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE ON "${tabla}" TO ${ROL_APP}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of ['decision_lineas', 'decisiones']) {
      await queryRunner.query(`REVOKE ALL ON "${tabla}" FROM ${ROL_APP}`);
    }
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata" WHERE "type" = 'GENERATED_COLUMN' AND "table" IN ('decisiones', 'decision_lineas') AND "name" = 'vigente'`,
    );
    // Índices, FK y políticas se van con las tablas.
    await queryRunner.query(`DROP TABLE "decision_lineas"`);
    await queryRunner.query(`DROP TABLE "decisiones"`);
  }
}
