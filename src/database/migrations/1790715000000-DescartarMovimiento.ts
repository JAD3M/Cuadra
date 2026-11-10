import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 5.6 (AD-4, AD-7): descartar un movimiento y deshacer el descarte.
 *
 * - `decisiones.descartada_por_id` y `descartada_at`: quién descartó y cuándo,
 *   para que solo esa persona (o un admin) pueda deshacer. El CHECK
 *   `ck_decisiones_descarte_persona` los exige en todo descarte. `cuadra_app`
 *   ya tiene SELECT, INSERT y UPDATE a nivel de tabla: no hace falta otro GRANT.
 * - `ck_bitacora_accion` suma 'descartar' y 'deshacer_descarte'. El CHECK va a
 *   mano (TypeORM no compara su texto) y debe coincidir con `ACCIONES_BITACORA`
 *   (src/common/entities/tipos.ts).
 *
 * `down` no borra datos: con una fila 'descartar' o 'deshacer_descarte' en la
 * bitácora, o un descarte en `decisiones`, el ADD CONSTRAINT o el DROP COLUMN
 * fallan o pierden el rastro, y qué hacer con eso es trabajo de una persona.
 */
const ACCIONES_ANTES =
  "'crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'cambiar_rol', 'quitar_rol', 'desactivar_separacion'";

export class DescartarMovimiento1790715000000 implements MigrationInterface {
  name = 'DescartarMovimiento1790715000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "decisiones" ADD "descartada_por_id" uuid, ADD "descartada_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisiones" ADD CONSTRAINT "fk_decisiones_descartada_por" FOREIGN KEY ("descartada_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisiones" ADD CONSTRAINT "ck_decisiones_descarte_persona" CHECK (tipo <> 'descarte' OR (descartada_por_id IS NOT NULL AND descartada_at IS NOT NULL))`,
    );
    await this.reemplazar(
      queryRunner,
      `${ACCIONES_ANTES}, 'descartar', 'deshacer_descarte'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.reemplazar(queryRunner, ACCIONES_ANTES);
    await queryRunner.query(
      `ALTER TABLE "decisiones" DROP CONSTRAINT "ck_decisiones_descarte_persona"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisiones" DROP CONSTRAINT "fk_decisiones_descartada_por"`,
    );
    await queryRunner.query(
      `ALTER TABLE "decisiones" DROP COLUMN "descartada_at", DROP COLUMN "descartada_por_id"`,
    );
  }

  private async reemplazar(
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
