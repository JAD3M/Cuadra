import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 5.7 (AD-4, AD-7): reabrir una confirmación.
 *
 * `ck_bitacora_accion` suma 'reabrir'. El CHECK va a mano (TypeORM no compara
 * su texto) y debe coincidir con `ACCIONES_BITACORA`
 * (src/common/entities/tipos.ts). No hay tablas ni columnas nuevas: el estado
 * `reabierta` y la liberación de los índices únicos `vigente` ya existían.
 *
 * `down` no borra datos: con una fila 'reabrir' en la bitácora el ADD
 * CONSTRAINT falla, y qué hacer con ella es trabajo de una persona.
 */
const ACCIONES_ANTES =
  "'crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'cambiar_rol', 'quitar_rol', 'desactivar_separacion', 'descartar', 'deshacer_descarte'";

export class ReabrirConfirmacion1790716000000 implements MigrationInterface {
  name = 'ReabrirConfirmacion1790716000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.reemplazar(queryRunner, `${ACCIONES_ANTES}, 'reabrir'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.reemplazar(queryRunner, ACCIONES_ANTES);
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
