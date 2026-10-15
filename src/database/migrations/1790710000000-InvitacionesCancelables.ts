import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 2.4 (FR-42, FR-50). Una persona administradora reenvía o cancela
 * una invitación pendiente.
 *
 * - `invitaciones.cancelada_en timestamptz NULL`: una invitación cancelada es
 *   un estado propio, distinto de `reemplazada_en`, para que quien abra el
 *   enlace lea «fue cancelada» y no «fue reemplazada».
 * - El índice único parcial `ux_invitaciones_viva` pasa a exigir también
 *   `cancelada_en IS NULL`: cancelar libera el correo para invitar de nuevo.
 * - GRANT UPDATE por columna de `cancelada_en` a `cuadra_app` (sigue sin
 *   DELETE ni UPDATE de tabla completa); el INSERT de tabla ya lo cubre.
 * - `reenviar_invitacion` y `cancelar_invitacion` entran al CHECK
 *   `ck_bitacora_accion`. La lista debe coincidir con `ACCIONES_BITACORA`
 *   (src/common/entities/tipos.ts); el texto va a mano porque TypeORM no
 *   compara el de un CHECK.
 */
const ROL_APP = 'cuadra_app';

export class InvitacionesCancelables1790710000000 implements MigrationInterface {
  name = 'InvitacionesCancelables1790710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invitaciones" ADD "cancelada_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`DROP INDEX "public"."ux_invitaciones_viva"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_invitaciones_viva" ON "invitaciones" ("company_id", "email") WHERE consumida_en IS NULL AND reemplazada_en IS NULL AND cancelada_en IS NULL`,
    );
    await queryRunner.query(
      `GRANT UPDATE (cancelada_en) ON "invitaciones" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las filas de bitácora con las acciones nuevas no caben en el CHECK
    // anterior (es de solo agregar): el ADD CONSTRAINT falla mientras existan
    // y se decide a mano qué hacer con ellas. Las invitaciones canceladas
    // vuelven a contar como vivas: si ya hay otra viva del mismo correo, el
    // índice único falla y se resuelve a mano.
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar'))`,
    );
    await queryRunner.query(
      `REVOKE UPDATE (cancelada_en) ON "invitaciones" FROM ${ROL_APP}`,
    );
    await queryRunner.query(`DROP INDEX "public"."ux_invitaciones_viva"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_invitaciones_viva" ON "invitaciones" ("company_id", "email") WHERE consumida_en IS NULL AND reemplazada_en IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitaciones" DROP COLUMN "cancelada_en"`,
    );
  }
}
