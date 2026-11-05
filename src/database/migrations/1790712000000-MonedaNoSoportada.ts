import { MigrationInterface, QueryRunner } from 'typeorm';
import { listaSql } from '../../common/entities/tipos';

/**
 * Historia 4.4 (AC3). Un CFDI que no está en MXN no se concilia: el movimiento
 * queda con el motivo `moneda_no_soportada`. Se ensancha el CHECK de
 * `regla_sin_match`; `down` lo devuelve a la lista anterior, tras limpiar las
 * filas que ya usaban el valor nuevo (el CHECK de par obliga a limpiar también
 * `motivo_sin_match`; la siguiente corrida de `conciliar` las vuelve a llenar).
 */
/**
 * Lista congelada de antes de esta migración. No se deriva de
 * `REGLAS_SIN_MATCH`: esa constante crece con cada historia y el `down` dejaría
 * en el CHECK valores que esta migración no conoce.
 */
const ANTERIORES = [
  'referencia_ambigua',
  'referencia_cfdi_ocupado',
  'referencia_cfdi_no_compatible',
  'sin_candidato_monto',
  'monto_multiples_candidatos',
  'monto_candidato_ocupado',
  'cfdi_multiples_movimientos',
] as const;

export class MonedaNoSoportada1790712000000 implements MigrationInterface {
  name = 'MonedaNoSoportada1790712000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_regla_sin_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_regla_sin_match" CHECK (regla_sin_match IS NULL OR regla_sin_match IN (${listaSql([...ANTERIORES, 'moneda_no_soportada'])}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "movimientos" SET "regla_sin_match" = NULL, "motivo_sin_match" = NULL, "evaluado_at" = NULL WHERE "regla_sin_match" = 'moneda_no_soportada'`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "ck_movimientos_regla_sin_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "ck_movimientos_regla_sin_match" CHECK (regla_sin_match IS NULL OR regla_sin_match IN (${listaSql(ANTERIORES)}))`,
    );
  }
}
