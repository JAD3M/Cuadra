import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-10. Con qué perfil de banco se leyó cada estado de cuenta. El worker lo
 * lee de aquí: el job solo lleva {cargaId, companyId}.
 *
 * Los estados de cuenta de CU-09 se leyeron con el formato canónico, que
 * ahora es el perfil 'cuadra': se les pone para que un reintento o una
 * reanudación los lea igual. Sin GRANTs nuevos: los de tabla cubren la
 * columna.
 */
export class PerfilDeBanco1790644740503 implements MigrationInterface {
  name = 'PerfilDeBanco1790644740503';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "perfil" character varying(64)`,
    );
    await queryRunner.query(
      `UPDATE "cargas" SET "perfil" = 'cuadra' WHERE "tipo" = 'estado_cuenta'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cargas" DROP COLUMN "perfil"`);
  }
}
