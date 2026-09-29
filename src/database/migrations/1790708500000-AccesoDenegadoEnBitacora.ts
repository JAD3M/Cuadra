import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-03.3. La acción 'acceso_denegado' de la bitácora: un 403 por rol o por
 * membresía se registra igual que cualquier otro evento. Solo cambia el
 * CHECK; la tabla ya tiene company_id, RLS con FORCE, su política y
 * SELECT/INSERT para cuadra_app (AislamientoRls).
 *
 * El CHECK va a mano: TypeORM no compara su texto.
 */
export class AccesoDenegadoEnBitacora1790708500000 implements MigrationInterface {
  name = 'AccesoDenegadoEnBitacora1790708500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las filas de acceso denegado no caben en el CHECK anterior; la
    // bitácora es de solo agregar, así que se decide a mano qué hacer con
    // ellas y el ADD CONSTRAINT falla mientras existan.
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN ('crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar'))`,
    );
  }
}
