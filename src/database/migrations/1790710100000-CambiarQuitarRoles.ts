import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 2.6 (FR-45, FR-46). Una persona administradora cambia o quita los
 * roles de alguien de su equipo.
 *
 * - `GRANT DELETE ON user_company_roles TO cuadra_app`: cambiar roles borra
 *   los que sobran e inserta los que faltan, y quitar acceso borra todos los
 *   de esa empresa. Es lo único que se concede: sin UPDATE (el INSERT por
 *   columna de la historia 1.x sigue igual) y sin DELETE en ninguna otra
 *   tabla de dominio.
 * - `cambiar_rol` y `quitar_rol` entran al CHECK `ck_bitacora_accion`. La
 *   lista debe coincidir con `ACCIONES_BITACORA`
 *   (src/common/entities/tipos.ts); el texto va a mano porque TypeORM no
 *   compara el de un CHECK.
 */
const ROL_APP = 'cuadra_app';

export class CambiarQuitarRoles1790710100000 implements MigrationInterface {
  name = 'CambiarQuitarRoles1790710100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `GRANT DELETE ON "user_company_roles" TO ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'cambiar_rol', 'quitar_rol'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las filas de bitácora con las acciones nuevas no caben en el CHECK
    // anterior (es de solo agregar): el ADD CONSTRAINT falla mientras existan
    // y se decide a mano qué hacer con ellas.
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion'))`,
    );
    await queryRunner.query(
      `REVOKE DELETE ON "user_company_roles" FROM ${ROL_APP}`,
    );
  }
}
