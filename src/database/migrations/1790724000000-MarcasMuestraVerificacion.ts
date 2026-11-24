import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 9.4 (AD-7, AD-10, FR-63). La verificación de la muestra agrega cada
 * marca como fila nueva de `muestras_verificacion` (sigue siendo solo agregar:
 * `cuadra_app` conserva SELECT e INSERT, sin UPDATE ni DELETE):
 *
 * - `verificador_id` y `resultado` (`conforme` | `desacuerdo`) van juntos o
 *   ninguno: las filas del sorteo (9.3) no tienen marca. La fecha de la marca
 *   es `created_at`.
 * - El índice único pasa a parcial: solo las filas del sorteo (`resultado IS
 *   NULL`) son únicas por empresa, mes y decisión; las marcas se acumulan y el
 *   estado de un caso es su última marca.
 * - La acción `verificar_muestra` entra al CHECK de la bitácora.
 *
 * `down` borra las marcas (las filas con resultado) y los datos de la 9.4:
 * corre con el rol dueño y después de un respaldo (docs/despliegue.md).
 */
const ACCIONES_ANTES =
  "'crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'cambiar_rol', 'quitar_rol', 'desactivar_separacion', 'descartar', 'deshacer_descarte', 'reabrir', 'comentar'";

export class MarcasMuestraVerificacion1790724000000 implements MigrationInterface {
  name = 'MarcasMuestraVerificacion1790724000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" ADD "verificador_id" uuid, ADD "resultado" character varying(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" ADD CONSTRAINT "ck_muestras_verificacion_marca" CHECK ((resultado IS NULL AND verificador_id IS NULL) OR (resultado IS NOT NULL AND resultado IN ('conforme', 'desacuerdo') AND verificador_id IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" ADD CONSTRAINT "fk_muestras_verificacion_verificador" FOREIGN KEY ("verificador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `DROP INDEX "ux_muestras_verificacion_empresa_mes_decision"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_muestras_verificacion_empresa_mes_decision" ON "muestras_verificacion" ("company_id", "mes", "decision_id") WHERE resultado IS NULL`,
    );
    await this.reemplazarAcciones(
      queryRunner,
      `${ACCIONES_ANTES}, 'verificar_muestra'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "bitacora" WHERE accion = 'verificar_muestra'`,
    );
    await this.reemplazarAcciones(queryRunner, ACCIONES_ANTES);
    await queryRunner.query(
      `DELETE FROM "muestras_verificacion" WHERE resultado IS NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "ux_muestras_verificacion_empresa_mes_decision"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_muestras_verificacion_empresa_mes_decision" ON "muestras_verificacion" ("company_id", "mes", "decision_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" DROP CONSTRAINT "fk_muestras_verificacion_verificador"`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" DROP CONSTRAINT "ck_muestras_verificacion_marca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "muestras_verificacion" DROP COLUMN "resultado", DROP COLUMN "verificador_id"`,
    );
  }

  private async reemplazarAcciones(
    queryRunner: QueryRunner,
    acciones: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN (${acciones}))`,
    );
  }
}
