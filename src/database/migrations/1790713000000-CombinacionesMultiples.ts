import { MigrationInterface, QueryRunner } from 'typeorm';
import { listaSql, REGLAS_SIN_MATCH } from '../../common/entities/tipos';

/**
 * Historia 4.5 (AC2). Un depósito que cubre varias facturas puede quedar sin
 * propuesta por dos razones nuevas: `combinaciones_multiples` (varios
 * subconjuntos suman el monto) y `candidatos_excedidos` (demasiados CFDI de
 * una contraparte para buscar). Se ensancha el CHECK de `regla_sin_match`;
 * `down` lo devuelve a la lista anterior, tras limpiar las filas que ya
 * usaban los valores nuevos (el CHECK de par obliga a limpiar también
 * `motivo_sin_match`; la siguiente corrida de `conciliar` las vuelve a llenar).
 */
const NUEVAS: readonly string[] = [
  'combinaciones_multiples',
  'candidatos_excedidos',
];
const ANTERIORES = REGLAS_SIN_MATCH.filter((r) => !NUEVAS.includes(r));

export class CombinacionesMultiples1790713000000 implements MigrationInterface {
  name = 'CombinacionesMultiples1790713000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_regla_sin_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_regla_sin_match" CHECK (regla_sin_match IS NULL OR regla_sin_match IN (${listaSql(REGLAS_SIN_MATCH)}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "movimientos" SET "regla_sin_match" = NULL, "motivo_sin_match" = NULL, "evaluado_at" = NULL WHERE "regla_sin_match" IN (${listaSql(NUEVAS)})`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_regla_sin_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_regla_sin_match" CHECK (regla_sin_match IS NULL OR regla_sin_match IN (${listaSql(ANTERIORES)}))`,
    );
  }
}
