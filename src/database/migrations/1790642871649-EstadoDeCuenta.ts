import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-09. Banco y cuenta del estado de cuenta, opcionales, en la carga: el job
 * solo lleva {cargaId, companyId} (CU-08), así que el worker los lee de aquí
 * para copiarlos a cada movimiento. Mismos largos que en `movimientos`.
 *
 * Sin GRANTs nuevos: los de tabla de `cuadra_app` sobre `cargas` cubren las
 * columnas nuevas.
 */
export class EstadoDeCuenta1790642871649 implements MigrationInterface {
  name = 'EstadoDeCuenta1790642871649';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "banco" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "cuenta" character varying(32)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cargas" DROP COLUMN "cuenta"`);
    await queryRunner.query(`ALTER TABLE "cargas" DROP COLUMN "banco"`);
  }
}
