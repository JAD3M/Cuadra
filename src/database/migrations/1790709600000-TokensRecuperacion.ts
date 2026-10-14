import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 1.6 (FR-43, AD-14). Recuperar la contraseña con un enlace de un
 * solo uso enviado al correo.
 *
 * - `tokens_recuperacion`: clase 2 (identidad, no dominio). Sin RLS: el enlace
 *   se consulta antes de que exista sesión. Solo guarda el SHA-256 del token.
 *   Cubre a las personas de empresa (`user_id`) y al dueño de plataforma
 *   (`plataforma_usuario_id`): un CHECK exige exactamente una de las dos y
 *   cada columna tiene su índice único parcial, así que hay un solo enlace
 *   vivo (consumida_en y reemplazada_en nulos) por cuenta.
 * - GRANTs explícitos para `cuadra_app`: SELECT, INSERT y UPDATE únicamente de
 *   `consumida_en`, `reemplazada_en` y `updated_at`. Sin DELETE.
 * - Restablecer cambia la contraseña: UPDATE por columna (`password_hash`,
 *   `updated_at`) sobre `users`, nunca de tabla completa. `plataforma_usuarios`
 *   ya tiene UPDATE de tabla desde la 1.3.
 * - `restablecer_contrasena` entra al CHECK de `bitacora_plataforma`; debe
 *   coincidir con `ACCIONES_BITACORA_PLATAFORMA` (src/common/entities/tipos.ts).
 *   La bitácora de empresa no cambia: usa `actualizar` sobre `users`.
 */
const ROL_APP = 'cuadra_app';

export class TokensRecuperacion1790709600000 implements MigrationInterface {
  name = 'TokensRecuperacion1790709600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tokens_recuperacion" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "plataforma_usuario_id" uuid, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "consumida_en" TIMESTAMP WITH TIME ZONE, "reemplazada_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ck_tokens_recuperacion_una_cuenta" CHECK ((user_id IS NOT NULL AND plataforma_usuario_id IS NULL) OR (user_id IS NULL AND plataforma_usuario_id IS NOT NULL)), CONSTRAINT "PK_tokens_recuperacion" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_tokens_recuperacion_token_hash" ON "tokens_recuperacion" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_tokens_recuperacion_viva_user" ON "tokens_recuperacion" ("user_id") WHERE consumida_en IS NULL AND reemplazada_en IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_tokens_recuperacion_viva_plataforma" ON "tokens_recuperacion" ("plataforma_usuario_id") WHERE consumida_en IS NULL AND reemplazada_en IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "fk_tokens_recuperacion_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens_recuperacion" ADD CONSTRAINT "fk_tokens_recuperacion_plataforma_usuario" FOREIGN KEY ("plataforma_usuario_id") REFERENCES "plataforma_usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "tokens_recuperacion" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `GRANT UPDATE (consumida_en, reemplazada_en, updated_at) ON "tokens_recuperacion" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `GRANT UPDATE (password_hash, updated_at) ON "users" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa', 'invitar', 'restablecer_contrasena'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las filas con 'restablecer_contrasena' no caben en el CHECK anterior; la
    // bitácora es de solo agregar, así que el ADD CONSTRAINT falla mientras
    // existan y se decide a mano qué hacer con ellas.
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa', 'invitar'))`,
    );
    await queryRunner.query(
      `REVOKE UPDATE (password_hash, updated_at) ON "users" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `REVOKE ALL ON "tokens_recuperacion" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens_recuperacion" DROP CONSTRAINT "fk_tokens_recuperacion_plataforma_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tokens_recuperacion" DROP CONSTRAINT "fk_tokens_recuperacion_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_tokens_recuperacion_viva_plataforma"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_tokens_recuperacion_viva_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ux_tokens_recuperacion_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE "tokens_recuperacion"`);
  }
}
