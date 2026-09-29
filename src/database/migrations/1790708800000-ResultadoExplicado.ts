import { MigrationInterface, QueryRunner } from 'typeorm';
import { listaSql, REGLAS_SIN_MATCH } from '../../common/entities/tipos';

/**
 * CU-13. Un movimiento abierto que no recibe propuesta guarda por qué:
 * `motivo_sin_match` (texto para el contador), `regla_sin_match` (código
 * estable) y `evaluado_at` (cuándo se fijó el resultado guardado). Las tres
 * columnas son NULL juntas cuando el movimiento tiene propuesta o nunca se
 * evaluó; no hay backfill, la siguiente corrida de `conciliar` las llena.
 *
 * - Los CHECK van a mano (TypeORM no compara su texto): los códigos son un
 *   contrato para la bandeja de CU-14 y la base los hace cumplir; motivo y
 *   regla nacen juntos o no nacen.
 * - `movimientos` ya tiene RLS FORCE y GRANT a nivel de tabla: nada nuevo.
 * - Índice (company_id, movimiento_id) en `conciliaciones`: el NOT EXISTS que
 *   decide si un movimiento tiene conciliación vigente busca por movimiento y
 *   `ux_conciliaciones_par` empieza por cfdi_id. EXPLAIN con 30k movimientos y
 *   15k conciliaciones, 500 búsquedas: 510 ms recorriendo todas las filas de la
 *   empresa por búsqueda contra 13 ms con este índice.
 */
export class ResultadoExplicado1790708800000 implements MigrationInterface {
  name = 'ResultadoExplicado1790708800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD "motivo_sin_match" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD "regla_sin_match" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD "evaluado_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_regla_sin_match" CHECK (regla_sin_match IS NULL OR regla_sin_match IN (${listaSql(REGLAS_SIN_MATCH)}))`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_sin_match_par" CHECK ((motivo_sin_match IS NULL) = (regla_sin_match IS NULL))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_conciliaciones_company_id_movimiento_id" ON "conciliaciones" ("company_id", "movimiento_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "ix_conciliaciones_company_id_movimiento_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_sin_match_par"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_regla_sin_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP COLUMN "evaluado_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP COLUMN "regla_sin_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP COLUMN "motivo_sin_match"`,
    );
  }
}
