import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Una conciliación solo puede apuntar a un CFDI y a un movimiento de su
 * propia empresa. Las FK de un solo campo (`cfdi_id`, `movimiento_id`) no
 * amarraban `company_id`: el dueño de la tabla (que no pasa por RLS) podía
 * insertar un cruce entre empresas. Ahora las FK son compuestas.
 *
 * - `UNIQUE (company_id, id)` en `cfdi` y `movimientos` es el destino que
 *   Postgres exige para una FK compuesta. Es redundante con la PK, pero es el
 *   único modo de referenciar el par.
 * - Se sueltan las FK viejas: la compuesta ya garantiza que el `id` exista
 *   (en la misma empresa), así que conservarlas solo duplicaría la
 *   verificación en cada INSERT/DELETE. Las nuevas heredan nombre y ON DELETE
 *   CASCADE.
 * - Sin tablas nuevas: RLS y GRANTs no cambian. Las FK referenciadoras usan
 *   `ux_conciliaciones_par` y `ix_conciliaciones_company_id_movimiento_id`.
 */
export class LlavesCompuestasConciliacion1790708900000 implements MigrationInterface {
  name = 'LlavesCompuestasConciliacion1790708900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_cfdi_company_id_id" ON "cfdi" ("company_id", "id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_movimientos_company_id_id" ON "movimientos" ("company_id", "id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_cfdi"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_movimiento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_cfdi" FOREIGN KEY ("company_id", "cfdi_id") REFERENCES "cfdi"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_movimiento" FOREIGN KEY ("company_id", "movimiento_id") REFERENCES "movimientos"("company_id", "id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_movimiento"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" DROP CONSTRAINT "fk_conciliaciones_cfdi"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_movimiento" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conciliaciones" ADD CONSTRAINT "fk_conciliaciones_cfdi" FOREIGN KEY ("cfdi_id") REFERENCES "cfdi"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`DROP INDEX "ux_movimientos_company_id_id"`);
    await queryRunner.query(`DROP INDEX "ux_cfdi_company_id_id"`);
  }
}
