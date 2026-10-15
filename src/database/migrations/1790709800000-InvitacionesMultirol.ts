import { MigrationInterface, QueryRunner } from 'typeorm';
import { listaSql, ROLES } from '../../common/entities/tipos';

/**
 * Historia 2.3 (FR-41, FR-50). Una persona administradora invita a su gente
 * con uno o más roles.
 *
 * - `roles text[] NOT NULL` reemplaza a `rol`: una invitación es un valor
 *   inmutable con sus roles. Las filas existentes pasan a `ARRAY[rol]`.
 *   `ck_invitaciones_roles`: al menos un rol y todos válidos; la lista sale de
 *   `ROLES` (src/common/entities/tipos.ts) para no repetir literales.
 * - `invitada_por_user_id uuid NULL` (FK a `users`): quien invita desde su
 *   empresa. `invitada_por_plataforma_usuario_id` pasa a ser nullable y
 *   `ck_invitaciones_invitador` exige exactamente uno de los dos.
 * - Sin GRANT nuevo: `cuadra_app` ya tiene INSERT de tabla completa sobre
 *   `invitaciones` (migración 1.5), que cubre las dos columnas nuevas; UPDATE
 *   sigue siendo solo de `consumida_en`, `reemplazada_en` y `updated_at`.
 *   La columna `rol` que se elimina se lleva su privilegio.
 * - El índice vivo único `(company_id, email)` no cambia.
 */
const LISTA_ROLES = listaSql(ROLES);

export class InvitacionesMultirol1790709800000 implements MigrationInterface {
  name = 'InvitacionesMultirol1790709800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitaciones" ADD "roles" text[]`);
    await queryRunner.query(`UPDATE "invitaciones" SET "roles" = ARRAY["rol"]`);
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ALTER COLUMN "roles" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "ck_invitaciones_rol"`,
    );
    await queryRunner.query(`ALTER TABLE "invitaciones" DROP COLUMN "rol"`);
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "ck_invitaciones_roles" CHECK (cardinality(roles) >= 1 AND roles <@ ARRAY[${LISTA_ROLES}]::text[])`,
    );

    await queryRunner.query(
      `ALTER TABLE "invitaciones" ALTER COLUMN "invitada_por_plataforma_usuario_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD "invitada_por_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "fk_invitaciones_invitada_por_user" FOREIGN KEY ("invitada_por_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "ck_invitaciones_invitador" CHECK ((invitada_por_plataforma_usuario_id IS NULL) <> (invitada_por_user_id IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las invitaciones de empresa (sin invitador de plataforma) no caben en el
    // NOT NULL anterior: el SET NOT NULL falla mientras existan y se decide a
    // mano qué hacer con ellas. De varios roles solo se conserva el primero.
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "ck_invitaciones_invitador"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "fk_invitaciones_invitada_por_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP COLUMN "invitada_por_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ALTER COLUMN "invitada_por_plataforma_usuario_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD "rol" character varying(32)`,
    );
    await queryRunner.query(`UPDATE "invitaciones" SET "rol" = "roles"[1]`);
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ALTER COLUMN "rol" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "ck_invitaciones_roles"`,
    );
    await queryRunner.query(`ALTER TABLE "invitaciones" DROP COLUMN "roles"`);
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "ck_invitaciones_rol" CHECK (rol IN (${LISTA_ROLES}))`,
    );
  }
}
