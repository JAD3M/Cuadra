import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 2.1 (FR-53, FR-54). Entra el rol `auditor`: solo consulta.
 *
 * Los dos CHECK de rol (`user_company_roles` e `invitaciones`) pasan a admitir
 * `auditor`. La lista debe coincidir con `ROLES` (src/common/entities/tipos.ts);
 * el texto va a mano porque TypeORM no compara el de un CHECK. No cambia RLS
 * ni GRANTs: ninguna política ni privilegio nombra roles.
 */
export class RolAuditor1790709700000 implements MigrationInterface {
  name = 'RolAuditor1790709700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" DROP CONSTRAINT "ck_user_company_roles_rol"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" ADD CONSTRAINT "ck_user_company_roles_rol" CHECK (rol IN ('admin', 'contador', 'revisor', 'auditor'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "ck_invitaciones_rol"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "ck_invitaciones_rol" CHECK (rol IN ('admin', 'contador', 'revisor', 'auditor'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las filas con 'auditor' no caben en el CHECK anterior: el ADD CONSTRAINT
    // falla mientras existan y se decide a mano qué hacer con ellas.
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "ck_invitaciones_rol"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "ck_invitaciones_rol" CHECK (rol IN ('admin', 'contador', 'revisor'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" DROP CONSTRAINT "ck_user_company_roles_rol"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_company_roles" ADD CONSTRAINT "ck_user_company_roles_rol" CHECK (rol IN ('admin', 'contador', 'revisor'))`,
    );
  }
}
