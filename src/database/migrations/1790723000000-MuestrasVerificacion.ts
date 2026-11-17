import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 9.3 (AD-10, AD-19, FR-63). Tabla de dominio (clase 1, solo agregar)
 * `muestras_verificacion`: las decisiones que el sorteo mensual eligió para
 * que un revisor las verifique. `company_id`, RLS con FORCE, política y GRANTs
 * aquí mismo; `cuadra_app` solo tiene SELECT e INSERT y las FK son RESTRICT.
 *
 * - `mes` es el primer día del mes sorteado (UTC).
 * - La muestra se guarda al generarse y no se re-sortea (AD-10): el índice
 *   único `(company_id, mes, decision_id)` es la red de seguridad de la carrera.
 * - La 9.4 agrega cada marca (verificador, resultado, fecha) como fila nueva,
 *   sin UPDATE, y ajustará ese índice a parcial.
 *
 * `down` borra la tabla y su muestra: corre con el rol dueño y después de un
 * respaldo (docs/despliegue.md).
 */
const ROL_APP = 'cuadra_app';

export class MuestrasVerificacion1790723000000 implements MigrationInterface {
  name = 'MuestrasVerificacion1790723000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "muestras_verificacion" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "mes" date NOT NULL, "decision_id" uuid NOT NULL, CONSTRAINT "PK_muestras_verificacion" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_muestras_verificacion_empresa_mes_decision" ON "muestras_verificacion" ("company_id", "mes", "decision_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_muestras_verificacion_company_id_decision_id" ON "muestras_verificacion" ("company_id", "decision_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" ADD CONSTRAINT "fk_muestras_verificacion_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" ADD CONSTRAINT "fk_muestras_verificacion_decision" FOREIGN KEY ("decision_id") REFERENCES "decisiones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_muestras_verificacion_company" ON "muestras_verificacion"
       USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
       WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "muestras_verificacion" TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE ALL ON "muestras_verificacion" FROM ${ROL_APP}`,
    );
    // Índices, FK y política se van con la tabla.
    await queryRunner.query(`DROP TABLE "muestras_verificacion"`);
  }
}
