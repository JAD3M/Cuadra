import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-17. `sugerencias_ia`: libro de lo que ya se le preguntó al modelo por un
 * movimiento, para no repetir la pregunta con la misma entrada.
 *
 * - Tabla de dominio: `company_id`, RLS con FORCE y su política, y GRANTs
 *   explícitos para `cuadra_app`, todo en esta migración.
 * - De solo agregar: `cuadra_app` recibe SELECT e INSERT y nada más. Una fila
 *   no se corrige ni se borra; si cambia la entrada, hay otra huella.
 * - Sin cambios en `conciliaciones`: `origen = 'llm'` ya está en su CHECK y
 *   `regla` no tiene restricción. Tampoco se agrega un CHECK sobre `origen`: el
 *   LLM no cierra casos porque `ck_conciliaciones_confirmada_requiere_persona`
 *   lo impide, y otro CHECK bloquearía que una persona confirme (CU-15) una
 *   propuesta del modelo.
 * - Sin montos: la regla de NUMERIC no aplica a esta tabla.
 */
const ROL_APP = 'cuadra_app';

export class SugerenciasIa1790709000000 implements MigrationInterface {
  name = 'SugerenciasIa1790709000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sugerencias_ia" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "movimiento_id" uuid NOT NULL, "input_hash" character(64) NOT NULL, "resultado" character varying(32) NOT NULL, CONSTRAINT "ck_sugerencias_ia_resultado" CHECK (resultado IN ('propuesta', 'sin_sugerencia')), CONSTRAINT "PK_353159326e80b5638755709c168" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_sugerencias_ia_movimiento_hash" ON "sugerencias_ia" ("company_id", "movimiento_id", "input_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" ADD CONSTRAINT "fk_sugerencias_ia_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" ADD CONSTRAINT "fk_sugerencias_ia_movimiento" FOREIGN KEY ("company_id", "movimiento_id") REFERENCES "movimientos"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_sugerencias_ia_company" ON "sugerencias_ia"
         USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
         WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "sugerencias_ia" TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP POLICY "rls_sugerencias_ia_company" ON "sugerencias_ia"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" NO FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" DISABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`REVOKE ALL ON "sugerencias_ia" FROM ${ROL_APP}`);
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" DROP CONSTRAINT "fk_sugerencias_ia_movimiento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sugerencias_ia" DROP CONSTRAINT "fk_sugerencias_ia_company"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_sugerencias_ia_movimiento_hash"`,
    );
    await queryRunner.query(`DROP TABLE "sugerencias_ia"`);
  }
}
