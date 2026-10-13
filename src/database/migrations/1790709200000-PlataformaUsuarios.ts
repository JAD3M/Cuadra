import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 1.3 (AD-2, AD-5). Cuenta propia del dueño de Cuadra y su bitácora,
 * y la separación de sujetos en `sesiones`.
 *
 * - `plataforma_usuarios` y `bitacora_plataforma` son clase 3 (AD-2): sin
 *   `company_id` propio de dominio y sin RLS; solo las toca el módulo
 *   `plataforma/`. La FK a empresa no existe en `bitacora_plataforma`: su
 *   `company_id` es informativo (a qué empresa apuntaba el intento), nunca
 *   un filtro de aislamiento.
 * - GRANTs explícitos para `cuadra_app` en esta migración. La bitácora de
 *   plataforma es de solo agregar: SELECT e INSERT, nunca UPDATE ni DELETE.
 *   `plataforma_usuarios` no recibe DELETE: una cuenta se desactiva.
 * - `sesiones`: `user_id` pasa a ser nulo y gana `plataforma_usuario_id`; un
 *   CHECK obliga a uno u otro según `tipo`. Las sesiones de tipo `plataforma`
 *   previas no pueden existir de forma legítima (el guard las rechazaba con
 *   401 y no había cuenta de plataforma), así que se borran antes del CHECK.
 * - Sin montos: la regla de NUMERIC no aplica.
 */
const ROL_APP = 'cuadra_app';

export class PlataformaUsuarios1790709200000 implements MigrationInterface {
  name = 'PlataformaUsuarios1790709200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "plataforma_usuarios" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "correo" character varying(320) NOT NULL, "password_hash" character varying(255) NOT NULL, "activo" boolean NOT NULL DEFAULT true, CONSTRAINT "ck_plataforma_usuarios_correo_normalizado" CHECK (correo = lower(btrim(correo))), CONSTRAINT "PK_plataforma_usuarios" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_plataforma_usuarios_correo" ON "plataforma_usuarios" ("correo")`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON "plataforma_usuarios" TO ${ROL_APP}`,
    );

    await queryRunner.query(
      `CREATE TABLE "bitacora_plataforma" ("id" uuid NOT NULL DEFAULT uuidv7(), "plataforma_usuario_id" uuid, "accion" character varying(64) NOT NULL, "detalle" jsonb, "company_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bitacora_plataforma" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bitacora_plataforma_created_at" ON "bitacora_plataforma" ("created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "fk_bitacora_plataforma_usuario" FOREIGN KEY ("plataforma_usuario_id") REFERENCES "plataforma_usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "bitacora_plataforma" TO ${ROL_APP}`,
    );

    await queryRunner.query(
      `DELETE FROM "sesiones" WHERE "tipo" = 'plataforma'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ALTER COLUMN "user_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD "plataforma_usuario_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sesiones_plataforma_usuario_id" ON "sesiones" ("plataforma_usuario_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD CONSTRAINT "fk_sesiones_plataforma_usuario" FOREIGN KEY ("plataforma_usuario_id") REFERENCES "plataforma_usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ADD CONSTRAINT "ck_sesiones_sujeto_por_tipo" CHECK ((tipo = 'empresa' AND user_id IS NOT NULL AND plataforma_usuario_id IS NULL) OR (tipo = 'plataforma' AND plataforma_usuario_id IS NOT NULL AND user_id IS NULL AND company_id IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sesiones" DROP CONSTRAINT "ck_sesiones_sujeto_por_tipo"`,
    );
    await queryRunner.query(`DELETE FROM "sesiones" WHERE "user_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "sesiones" DROP CONSTRAINT "fk_sesiones_plataforma_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_sesiones_plataforma_usuario_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" DROP COLUMN "plataforma_usuario_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sesiones" ALTER COLUMN "user_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `REVOKE ALL ON "bitacora_plataforma" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "fk_bitacora_plataforma_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_bitacora_plataforma_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "bitacora_plataforma"`);

    await queryRunner.query(
      `REVOKE ALL ON "plataforma_usuarios" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_plataforma_usuarios_correo"`,
    );
    await queryRunner.query(`DROP TABLE "plataforma_usuarios"`);
  }
}
