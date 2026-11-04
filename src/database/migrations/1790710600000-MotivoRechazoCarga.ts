import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 3.7 (FR-3, parte): el motivo con que se descartó una vista previa.
 * - `cargas.motivo_rechazo` text NULL: lo escribe `POST /cargas/:id/rechazar`
 *   (lo que dijo la persona o un mensaje fijo del backend). Solo las cargas
 *   'rechazada' lo traen.
 *
 * Es una columna de una tabla que ya existe: RLS FORCE y los GRANT de `cargas`
 * no cambian, y no hay CHECK nuevo.
 */
export class MotivoRechazoCarga1790710600000 implements MigrationInterface {
  name = 'MotivoRechazoCarga1790710600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cargas" ADD "motivo_rechazo" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP COLUMN "motivo_rechazo"`,
    );
  }
}
