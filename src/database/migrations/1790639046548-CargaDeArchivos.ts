import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-06.
 * - `cargas.errores`: {archivo, motivo} por cada archivo del lote que no entró.
 * - 'parcialidades' en `ck_cfdi_estado`: el estado inicial de un PPD (CU-05).
 *   TypeORM no compara el texto de los CHECK, así que este cambio no lo
 *   genera `migration:generate`: va a mano.
 *
 * Sin GRANTs nuevos: `cuadra_app` ya tiene SELECT/INSERT/UPDATE sobre
 * `cargas` a nivel tabla, y eso cubre la columna nueva.
 */
export class CargaDeArchivos1790639046548 implements MigrationInterface {
  name = 'CargaDeArchivos1790639046548';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "errores" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" DROP CONSTRAINT "ck_cfdi_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" ADD CONSTRAINT "ck_cfdi_estado" CHECK (estado IN ('abierta', 'parcialidades', 'conciliada', 'cancelada'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Si ya hay CFDI en 'parcialidades', el ADD CONSTRAINT falla y el down
    // se detiene: decidir a qué estado pasan es trabajo de una persona.
    await queryRunner.query(
      `ALTER TABLE "cfdi" DROP CONSTRAINT "ck_cfdi_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cfdi" ADD CONSTRAINT "ck_cfdi_estado" CHECK (estado IN ('abierta', 'conciliada', 'cancelada'))`,
    );
    await queryRunner.query(`ALTER TABLE "cargas" DROP COLUMN "errores"`);
  }
}
