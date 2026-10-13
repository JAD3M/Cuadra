import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 1.1 (AD-2, AD-6). `sesiones`: una fila por sesión abierta, que
 * reemplaza al JWT de la v1 (D-09). La cookie lleva el token; la tabla solo
 * guarda su SHA-256, nunca el token.
 *
 * - Clase 2 (AD-2): identidad, no dominio. Sin RLS: el guard la lee antes de
 *   saber la empresa y fuera de la transacción de empresa. `company_id` es
 *   nulo hasta elegir empresa y para el tipo `plataforma`.
 * - GRANTs explícitos para `cuadra_app` en esta migración: SELECT, INSERT,
 *   UPDATE (renovar y rotar) y DELETE (cerrar sesión). Es la única tabla que
 *   gana DELETE en esta historia; ninguna otra cambia de permisos.
 * - Sin montos: la regla de NUMERIC no aplica a esta tabla.
 */
const ROL_APP = 'cuadra_app';

export class Sesiones1790709100000 implements MigrationInterface {
  name = 'Sesiones1790709100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sesiones" ("id" uuid NOT NULL DEFAULT uuidv7(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "tipo" character varying(16) NOT NULL, "company_id" uuid, "ultima_actividad" TIMESTAMP WITH TIME ZONE NOT NULL, "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "ck_sesiones_tipo" CHECK (tipo IN ('empresa', 'plataforma')), CONSTRAINT "PK_sesiones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_sesiones_token_hash" ON "sesiones" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sesiones_user_id" ON "sesiones" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sesiones_expira_en" ON "sesiones" ("expira_en")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD CONSTRAINT "fk_sesiones_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD CONSTRAINT "fk_sesiones_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "sesiones" TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE ALL ON "sesiones" FROM ${ROL_APP}`);
    await queryRunner.query(
      `ALTER TABLE "sesiones" DROP CONSTRAINT "fk_sesiones_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" DROP CONSTRAINT "fk_sesiones_user"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_sesiones_expira_en"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sesiones_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."ux_sesiones_token_hash"`);
    await queryRunner.query(`DROP TABLE "sesiones"`);
  }
}
