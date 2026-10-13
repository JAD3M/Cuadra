import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 1.3 (AD-7). Las acciones de `bitacora_plataforma` salen de
 * `ACCIONES_BITACORA_PLATAFORMA` (src/common/entities/tipos.ts) y el CHECK
 * las fija en el motor. El texto va a mano: TypeORM no compara el de un CHECK.
 * La lista debe coincidir con la del archivo de tipos; el spec de la tabla lo
 * comprueba.
 */
export class AccionesBitacoraPlataforma1790709300000 implements MigrationInterface {
  name = 'AccionesBitacoraPlataforma1790709300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
  }
}
