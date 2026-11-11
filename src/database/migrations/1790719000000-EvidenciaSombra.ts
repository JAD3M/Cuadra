import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 6.1 (AD-2, AD-3, AD-10, FR-34, FR-38). Tabla de dominio (clase 1,
 * solo agregar) `evidencia_sombra`: una fila por evento del modo sombra, que
 * nunca se actualiza ni se borra. `company_id`, RLS con FORCE, política y
 * GRANTs aquí mismo; `cuadra_app` solo tiene SELECT e INSERT y las FK son
 * RESTRICT para que la evidencia no se pierda.
 *
 * - `banco` es nulo cuando el movimiento no lo trae (`movimientos.banco`).
 * - `persona_id` es nulo en `habria_cerrado`: la 6.2 lo llena con quien confirmó,
 *   rechazó, desmarcó o reabrió.
 * - El CHECK de `evento` debe coincidir con `EVENTOS_SOMBRA`
 *   (src/common/entities/tipos.ts). Hoy solo `habria_cerrado`; la 6.2 suma los
 *   otros cuatro.
 * - El índice único parcial hace que una decisión no registre dos veces
 *   `habria_cerrado`, ni siquiera por una carrera.
 *
 * `down` borra la tabla y su evidencia: corre con el rol dueño y después de un
 * respaldo (docs/despliegue.md).
 */
const ROL_APP = 'cuadra_app';

export class EvidenciaSombra1790719000000 implements MigrationInterface {
  name = 'EvidenciaSombra1790719000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "evidencia_sombra" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "banco" character varying(128), "decision_id" uuid NOT NULL, "evento" character varying(32) NOT NULL, "persona_id" uuid, CONSTRAINT "ck_evidencia_sombra_evento" CHECK (evento IN ('habria_cerrado')), CONSTRAINT "PK_evidencia_sombra" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_evidencia_sombra_habria_cerrado" ON "evidencia_sombra" ("decision_id") WHERE evento = 'habria_cerrado'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_evidencia_sombra_company_id_evento" ON "evidencia_sombra" ("company_id", "evento")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_evidencia_sombra_company_id_decision_id" ON "evidencia_sombra" ("company_id", "decision_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" ADD CONSTRAINT "fk_evidencia_sombra_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" ADD CONSTRAINT "fk_evidencia_sombra_decision" FOREIGN KEY ("decision_id") REFERENCES "decisiones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" ADD CONSTRAINT "fk_evidencia_sombra_persona" FOREIGN KEY ("persona_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "evidencia_sombra" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_evidencia_sombra_company" ON "evidencia_sombra"
       USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
       WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "evidencia_sombra" TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE ALL ON "evidencia_sombra" FROM ${ROL_APP}`);
    // Índices, FK y política se van con la tabla.
    await queryRunner.query(`DROP TABLE "evidencia_sombra"`);
  }
}
