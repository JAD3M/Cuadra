import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 5.8 (AD-4, AD-19): reabrir un lote completo busca las decisiones
 * por `lote_id`. Sin índice cada reapertura sería un recorrido de toda la
 * tabla de la empresa. Parcial: casi todas las decisiones no tienen lote.
 * No hay GRANT nuevo (es un índice). `down` lo borra sin tocar datos.
 */
export class IndiceLoteDecisiones1790717000000 implements MigrationInterface {
  name = 'IndiceLoteDecisiones1790717000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "ix_decisiones_company_lote" ON "decisiones" ("company_id", "lote_id") WHERE lote_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_decisiones_company_lote"`);
  }
}
