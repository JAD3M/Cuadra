import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-12. La tolerancia de monto del motor de reglas pasa de constante a
 * configuración de cada empresa: `companies.tolerancia_monto`, en MXN
 * absolutos. Estricta por omisión (0); aflojarla es una decisión explícita.
 *
 * - CHECK 0..100.00: un valor fuera de rango es un error de captura, y la
 *   base lo rechaza aunque otra ruta escriba la columna.
 * - `companies` no tiene RLS ni UPDATE para `cuadra_app`. Se concede solo
 *   sobre esta columna: la app no puede tocar rfc, razón social ni nada más.
 *   El CHECK va a mano: TypeORM no compara su texto.
 */
export class ToleranciaPorEmpresa1790708700000 implements MigrationInterface {
  name = 'ToleranciaPorEmpresa1790708700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "tolerancia_monto" numeric(18,4) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD CONSTRAINT "ck_companies_tolerancia_monto_rango" CHECK (tolerancia_monto >= 0 AND tolerancia_monto <= 100)`,
    );
    await queryRunner.query(
      `GRANT UPDATE (tolerancia_monto) ON "companies" TO cuadra_app`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE UPDATE (tolerancia_monto) ON "companies" FROM cuadra_app`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP CONSTRAINT "ck_companies_tolerancia_monto_rango"`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN "tolerancia_monto"`,
    );
  }
}
