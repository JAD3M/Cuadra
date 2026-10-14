import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 1.5 (FR-40, AD-14). El dueño invita a la primera persona
 * administradora por correo; la persona acepta con un enlace de un solo uso.
 *
 * - `invitaciones`: clase 2 (identidad, no dominio). Sin RLS: el enlace se
 *   consulta antes de que exista sesión. Solo guarda el SHA-256 del token.
 *   Una sola invitación viva por (empresa, correo): índice único parcial.
 * - GRANTs explícitos para `cuadra_app`: SELECT, INSERT y UPDATE únicamente de
 *   `consumida_en`, `reemplazada_en` y `updated_at`. Sin DELETE.
 * - `users` y `user_company_roles` solo se leían. Aceptar la invitación crea
 *   la cuenta y el rol, así que se concede INSERT por columna (nunca de tabla
 *   completa): `email`, `nombre`, `password_hash` y `user_id`, `company_id`,
 *   `rol`. El resto toma su valor por defecto.
 * - `invitar` entra a los CHECK de `bitacora` y `bitacora_plataforma`. Las
 *   listas deben coincidir con `ACCIONES_BITACORA` y
 *   `ACCIONES_BITACORA_PLATAFORMA` (src/common/entities/tipos.ts); el texto
 *   va a mano porque TypeORM no compara el de un CHECK.
 */
const ROL_APP = 'cuadra_app';

export class Invitaciones1790709500000 implements MigrationInterface {
  name = 'Invitaciones1790709500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "invitaciones" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "email" character varying(320) NOT NULL, "rol" character varying(32) NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "consumida_en" TIMESTAMP WITH TIME ZONE, "reemplazada_en" TIMESTAMP WITH TIME ZONE, "invitada_por_plataforma_usuario_id" uuid NOT NULL, CONSTRAINT "ck_invitaciones_rol" CHECK (rol IN ('admin', 'contador', 'revisor')), CONSTRAINT "PK_invitaciones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_invitaciones_token_hash" ON "invitaciones" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_invitaciones_viva" ON "invitaciones" ("company_id", "email") WHERE consumida_en IS NULL AND reemplazada_en IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "fk_invitaciones_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD CONSTRAINT "fk_invitaciones_plataforma_usuario" FOREIGN KEY ("invitada_por_plataforma_usuario_id") REFERENCES "plataforma_usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "invitaciones" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `GRANT UPDATE (consumida_en, reemplazada_en, updated_at) ON "invitaciones" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `GRANT INSERT (email, nombre, password_hash) ON "users" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `GRANT INSERT (user_id, company_id, rol) ON "user_company_roles" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa', 'invitar'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las filas con 'invitar' no caben en los CHECK anteriores; las dos
    // bitácoras son de solo agregar, así que el ADD CONSTRAINT falla mientras
    // existan y se decide a mano qué hacer con ellas.
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado'))`,
    );
    await queryRunner.query(
      `REVOKE INSERT (user_id, company_id, rol) ON "user_company_roles" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `REVOKE INSERT (email, nombre, password_hash) ON "users" FROM ${ROL_APP}`,
    );
    await queryRunner.query(`REVOKE ALL ON "invitaciones" FROM ${ROL_APP}`);
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "fk_invitaciones_plataforma_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP CONSTRAINT "fk_invitaciones_company"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ux_invitaciones_viva"`);
    await queryRunner.query(`DROP INDEX "public"."ux_invitaciones_token_hash"`);
    await queryRunner.query(`DROP TABLE "invitaciones"`);
  }
}
