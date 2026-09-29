import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-08.
 * - `carga_archivos`: los archivos en espera viven en Postgres, no en Redis.
 *   Tabla de dominio: company_id, RLS con FORCE, política y GRANTs aquí
 *   mismo (CLAUDE.md). Sin UPDATE ni DELETE: se escriben una vez.
 * - `ck_cargas_estado` con los cinco estados. 'con_errores' = terminó con al
 *   menos un XML inválido; 'fallida' = se agotaron los reintentos.
 * - `ck_cargas_total_cuadra`: suma exacta solo en procesada y con_errores;
 *   en los demás, los contadores no pasan del total.
 * - Datos: con la regla nueva, una carga de CU-06/07 que terminó con algún
 *   XML inválido es 'con_errores'. Eso incluye las 'fallida' de antes, que
 *   lo eran porque todos sus XML eran inválidos, no por infraestructura.
 *
 * Los CHECK van a mano: TypeORM no compara su texto.
 */
export class ProcesamientoEnCola1790641338024 implements MigrationInterface {
  name = 'ProcesamientoEnCola1790641338024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "carga_archivos" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "carga_id" uuid NOT NULL, "orden" integer NOT NULL, "nombre" character varying(255) NOT NULL, "hash" character(64) NOT NULL, "contenido" text, CONSTRAINT "PK_1d3d14ca33ddfa3b5b674a78e37" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_carga_archivos_company_id_carga_id" ON "carga_archivos"  ("company_id", "carga_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_carga_archivos_carga_orden" ON "carga_archivos"  ("carga_id", "orden") `,
    );
    await queryRunner.query(
      `ALTER TABLE "carga_archivos" ADD CONSTRAINT "fk_carga_archivos_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "carga_archivos" ADD CONSTRAINT "fk_carga_archivos_carga" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "carga_archivos" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "carga_archivos" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_carga_archivos_company" ON "carga_archivos"
         USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
         WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON carga_archivos TO cuadra_app`,
    );

    // Primero los datos, para que el CHECK nuevo los encuentre en regla.
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_estado"`,
    );
    await queryRunner.query(
      `UPDATE "cargas" SET "estado" = 'con_errores', "updated_at" = now()
        WHERE "estado" IN ('procesada', 'fallida') AND "registros_error" > 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'con_errores', 'fallida'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_total_cuadra"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_total_cuadra" CHECK ((estado IN ('procesada', 'con_errores') AND total_registros = registros_ok + registros_error + registros_existentes) OR (estado NOT IN ('procesada', 'con_errores') AND registros_ok + registros_error + registros_existentes <= total_registros))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // CU-07 exige la suma exacta en todos los estados. Una carga pendiente,
    // procesando o fallida por infraestructura no la cumple, y el ADD
    // CONSTRAINT falla: qué hacer con ella es trabajo de una persona.
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_total_cuadra"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_estado"`,
    );
    // Regla de CU-07: 'fallida' solo si nada quedó en la base.
    await queryRunner.query(
      `UPDATE "cargas"
          SET "estado" = CASE
                WHEN "registros_ok" + "registros_existentes" > 0 THEN 'procesada'
                ELSE 'fallida'
              END,
              "updated_at" = now()
        WHERE "estado" = 'con_errores'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'fallida'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_total_cuadra" CHECK (total_registros = registros_ok + registros_error + registros_existentes)`,
    );

    await queryRunner.query(`REVOKE ALL ON carga_archivos FROM cuadra_app`);
    await queryRunner.query(
      `ALTER TABLE "carga_archivos" DROP CONSTRAINT "fk_carga_archivos_carga"`,
    );
    await queryRunner.query(
      `ALTER TABLE "carga_archivos" DROP CONSTRAINT "fk_carga_archivos_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_carga_archivos_carga_orden"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_carga_archivos_company_id_carga_id"`,
    );
    // La política se va con la tabla.
    await queryRunner.query(`DROP TABLE "carga_archivos"`);
  }
}
